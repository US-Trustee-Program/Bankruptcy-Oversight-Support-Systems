import * as mssql from 'mssql';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AtsGateway } from '../../../use-cases/gateways.types';
import {
  AtsTrusteeRecord,
  AtsAppointmentRecord,
  TrusteeAppointmentsResult,
  FailedAppointment,
} from '../../types/ats.types';
import { DbTableFieldSpec } from '../../types/database';
import { getCamsError } from '../../../common-errors/error-utilities';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { cleanseAndMapAppointment } from './cleansing/ats-cleansing-pipeline';
import { CleansingClassification, TrusteeOverride } from './cleansing/ats-cleansing-types';
import { transformAppointmentRecord } from './cleansing/ats-cleansing-transform';
import { loadTrusteeOverrides } from './cleansing/ats-cleansing-overrides';

const MODULE_NAME = 'ATS-GATEWAY';

/**
 * Gateway for accessing the ATS (Attorney Trustee System) database.
 * Implements queries for trustee demographics and appointments.
 */
export class AtsGatewayImpl extends AbstractMssqlClient implements AtsGateway {
  private overridesCache?: Map<string, TrusteeOverride[]>;

  constructor(context: ApplicationContext) {
    // Use ATS-specific database configuration
    const config = context.config.atsDbConfig;
    super(config, MODULE_NAME);
  }

  /**
   * Lazy-load overrides cache on first use
   */
  private async getOverridesCache(
    context: ApplicationContext,
  ): Promise<Map<string, TrusteeOverride[]>> {
    if (!this.overridesCache) {
      const result = await loadTrusteeOverrides(context);
      if (result.error) {
        context.logger.error(
          MODULE_NAME,
          'Failed to load overrides, proceeding without overrides',
          {
            error: result.error.message,
          },
        );
        this.overridesCache = new Map();
      } else {
        this.overridesCache = result.data;
      }
    }
    return this.overridesCache;
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
   * Get cleansed appointments for a trustee.
   * Returns both clean appointments (for storage) and failed appointments (for DLQ).
   * Gateway handles ATS data cleansing and transformation internally.
   *
   * This method:
   * 1. Queries raw ATS data from CHAPTER_DETAILS table
   * 2. Runs each appointment through the cleansing pipeline
   * 3. Transforms cleansed data to CAMS domain types
   * 4. Returns both successful and failed appointments with statistics
   *
   * Cleansing handles:
   * - Invalid/uncleansable data (returned as failed appointments)
   * - Multi-expansion (1:N mapping for multi-district states)
   * - Data normalization and validation
   */
  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<TrusteeAppointmentsResult> {
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
        SERVING_STATE AS STATE,
        CHAPTER,
        APPOINTED_DATE AS DATE_APPOINTED,
        STATUS,
        STATUS_EFF_DATE AS EFFECTIVE_DATE
      FROM CHAPTER_DETAILS
      WHERE TRU_ID = @trusteeId
      ORDER BY APPOINTED_DATE DESC`;

    context.logger.debug(MODULE_NAME, `Querying appointments for trustee ID: ${trusteeId}`);

    try {
      // 1. Fetch raw ATS data
      const { results } = await this.executeQuery<AtsAppointmentRecord>(context, query, input);
      const atsAppointments = results as AtsAppointmentRecord[];

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${atsAppointments.length} raw appointments for trustee ${trusteeId}`,
      );

      // 2. Cleanse and transform each appointment
      const overridesCache = await this.getOverridesCache(context);
      const cleanAppointments: TrusteeAppointmentInput[] = [];
      const failedAppointments: FailedAppointment[] = [];
      const stats = {
        total: atsAppointments.length,
        clean: 0,
        autoRecoverable: 0,
        problematic: 0,
        uncleansable: 0,
        skipped: 0,
      };

      for (const atsAppointment of atsAppointments) {
        const cleansingResult = cleanseAndMapAppointment(
          context,
          String(trusteeId),
          atsAppointment,
          overridesCache,
        );

        // Handle SKIP classification
        if (cleansingResult.classification === CleansingClassification.SKIP) {
          context.logger.debug(MODULE_NAME, `Skipping appointment per override directive`, {
            trusteeId,
            notes: cleansingResult.notes,
          });
          stats.skipped++;
          continue;
        }

        // Handle UNCLEANSABLE or PROBLEMATIC - ADD TO FAILED LIST
        if (
          cleansingResult.classification === CleansingClassification.UNCLEANSABLE ||
          cleansingResult.classification === CleansingClassification.PROBLEMATIC
        ) {
          context.logger.warn(
            MODULE_NAME,
            `Appointment is ${cleansingResult.classification} for trustee ${trusteeId}`,
            {
              notes: cleansingResult.notes,
            },
          );

          // Add to failed appointments list for DLQ
          failedAppointments.push({
            atsAppointment,
            classification: cleansingResult.classification as 'PROBLEMATIC' | 'UNCLEANSABLE',
            notes: cleansingResult.notes,
            mapType: cleansingResult.mapType,
            timestamp: new Date().toISOString(),
          });

          if (cleansingResult.classification === CleansingClassification.PROBLEMATIC) {
            stats.problematic++;
          } else {
            stats.uncleansable++;
          }

          continue;
        }

        // Track CLEAN vs AUTO_RECOVERABLE
        if (cleansingResult.classification === CleansingClassification.CLEAN) {
          stats.clean++;
        } else if (cleansingResult.classification === CleansingClassification.AUTO_RECOVERABLE) {
          stats.autoRecoverable++;
        }

        // Handle multi-expansion (1:N mapping)
        if (!cleansingResult.appointment && cleansingResult.courtIds.length > 1) {
          context.logger.debug(
            MODULE_NAME,
            `Multi-expansion: creating ${cleansingResult.courtIds.length} appointments`,
            {
              trusteeId,
              courtIds: cleansingResult.courtIds,
            },
          );

          for (const courtId of cleansingResult.courtIds) {
            const appointmentInput = transformAppointmentRecord(atsAppointment, courtId);
            cleanAppointments.push(appointmentInput);
          }
        } else if (cleansingResult.appointment) {
          // Single appointment (1:1 mapping)
          cleanAppointments.push(cleansingResult.appointment);
        }
      }

      context.logger.info(
        MODULE_NAME,
        `Cleansed ${atsAppointments.length} raw appointments → ${cleanAppointments.length} clean, ${failedAppointments.length} failed (${stats.skipped} skipped)`,
      );

      return {
        cleanAppointments,
        failedAppointments,
        stats,
      };
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
