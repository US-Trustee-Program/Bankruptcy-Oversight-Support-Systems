import * as mssql from 'mssql';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AtsGateway } from '../../../use-cases/gateways.types';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../types/ats.types';
import { DbTableFieldSpec } from '../../types/database';
import { getCamsError } from '../../../common-errors/error-utilities';

const MODULE_NAME = 'ATS-GATEWAY';

/**
 * Gateway for accessing the ATS (Attorney Trustee System) database.
 * Implements queries for trustee demographics and appointments.
 */
export class AtsGatewayImpl extends AbstractMssqlClient implements AtsGateway {
  constructor(context: ApplicationContext) {
    // Use ATS-specific database configuration
    const config = context.config.atsDbConfig;
    super(config, MODULE_NAME);
  }

  /**
   * Get a page of trustees for migration processing.
   * Uses cursor-based pagination with TRU_ID as the cursor.
   */
  async getTrusteesPage(
    context: ApplicationContext,
    lastTrusteeId: number | null,
    pageSize: number,
  ): Promise<AtsTrusteeRecord[]> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'pageSize',
      type: mssql.Int,
      value: pageSize,
    });

    let query = `
      SELECT
        ID,
        LAST_NAME,
        FIRST_NAME,
        MIDDLE,
        COMPANY,
        STREET,
        STREET1,
        CITY,
        STATE,
        ZIP,
        ZIP_PLUS,
        STREET_A2,
        STREET1_A2,
        CITY_A2,
        STATE_A2,
        ZIP_A2,
        ZIP_PLUS_A2,
        TELEPHONE,
        EMAIL_ADDRESS
      FROM TRUSTEES`;

    if (lastTrusteeId !== null) {
      query += ` WHERE ID > @lastId`;
      input.push({
        name: 'lastId',
        type: mssql.Int,
        value: lastTrusteeId,
      });
    }

    query += `
      ORDER BY ID
      OFFSET 0 ROWS FETCH NEXT @pageSize ROWS ONLY`;

    context.logger.debug(
      MODULE_NAME,
      `Querying trustees page with lastId: ${lastTrusteeId}, pageSize: ${pageSize}`,
    );

    try {
      const { results } = await this.executeQuery<AtsTrusteeRecord>(context, query, input);
      const trustees = results as AtsTrusteeRecord[];

      context.logger.info(MODULE_NAME, `Retrieved ${trustees.length} trustees from ATS`);
      return trustees;
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to retrieve trustees page from ATS',
      );
      context.logger.error(MODULE_NAME, 'Error retrieving trustees', {
        lastTrusteeId,
        pageSize,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all appointments for a specific trustee.
   * Includes chapter, division, district, and status information.
   */
  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<AtsAppointmentRecord[]> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'trusteeId',
      type: mssql.Int,
      value: trusteeId,
    });

    const query = `
      SELECT
        TRU_ID,
        DISTRICT,
        DIVISION,
        CHAPTER,
        APPOINTED_DATE AS DATE_APPOINTED,
        STATUS,
        STATUS_EFF_DATE AS EFFECTIVE_DATE
      FROM CHAPTER_DETAILS
      WHERE TRU_ID = @trusteeId
      ORDER BY APPOINTED_DATE DESC`;

    context.logger.debug(MODULE_NAME, `Querying appointments for trustee ID: ${trusteeId}`);

    try {
      const { results } = await this.executeQuery<AtsAppointmentRecord>(context, query, input);
      const appointments = results as AtsAppointmentRecord[];

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${appointments.length} appointments for trustee ${trusteeId}`,
      );
      return appointments;
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to retrieve appointments for trustee ${trusteeId}`,
      );
      context.logger.error(MODULE_NAME, 'Error retrieving appointments', {
        trusteeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the total count of trustees in the ATS database.
   * Useful for progress tracking during migration.
   */
  async getTrusteeCount(context: ApplicationContext): Promise<number> {
    const query = `SELECT COUNT(*) as totalCount FROM TRUSTEES`;

    context.logger.debug(MODULE_NAME, 'Querying total trustee count');

    try {
      const { results } = await this.executeQuery<{ totalCount: number }>(context, query);
      const count = (results as Array<{ totalCount: number }>)[0]?.totalCount || 0;

      context.logger.info(MODULE_NAME, `Total trustees in ATS: ${count}`);
      return count;
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to get trustee count from ATS',
      );
      context.logger.error(MODULE_NAME, 'Error getting trustee count', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Test the connection to the ATS database.
   * Returns true if connection is successful.
   */
  async testConnection(context: ApplicationContext): Promise<boolean> {
    const query = `SELECT 1 as test`;

    try {
      await this.executeQuery(context, query);
      context.logger.info(MODULE_NAME, 'ATS database connection test successful');
      return true;
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'ATS database connection test failed');
      context.logger.error(MODULE_NAME, 'Connection test failed', {
        error: error.message,
      });
      return false;
    }
  }
}
