import * as mssql from 'mssql';
import {
  AcmsConsolidation,
  AcmsConsolidationChildCase,
  AcmsPredicate,
} from '../../../use-cases/acms-orders/acms-orders';
import { AcmsGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { getCamsError } from '../../../common-errors/error-utilities';
import { DbTableFieldSpec } from '../../types/database';

const MODULE_NAME = 'ACMS_GATEWAY';

export class AcmsGatewayImpl extends AbstractMssqlClient implements AcmsGateway {
  constructor(context: ApplicationContext) {
    // The context carries different database connection configurations.
    // We pick off the configuration specific to this ACMS gateway.
    const config = context.config.acmsDbConfig;
    super(config, MODULE_NAME);
  }

  async getCaseIdsToMigrate(context: ApplicationContext): Promise<string[]> {
    const query = `
      SELECT CONCAT(
          RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3),
              '-',
          RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2),
              '-',
          RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId
      FROM [dbo].[CMMDB]
      WHERE (CLOSED_BY_COURT_DATE > 20180101 OR CLOSED_BY_UST_DATE > 20180101 OR (CLOSED_BY_COURT_DATE = 0 and CLOSED_BY_UST_DATE = 0))`;

    type ResultType = {
      caseId: string;
    };

    try {
      const { results } = await this.executeQuery<ResultType>(context, query);
      const leadCaseIdsResults = results as ResultType[];
      return leadCaseIdsResults.map((record) => record.caseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, originalError.message);
    }
  }

  async getLeadCaseIds(context: ApplicationContext, predicate: AcmsPredicate): Promise<string[]> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'divisionCode',
      type: mssql.Int,
      value: predicate.divisionCode,
    });

    let query = `
      SELECT ((CASE_DIV * 10000000) + (CASE_YEAR * 100000) + CASE_NUMBER) AS leadCaseId
      FROM [dbo].[CMMDB]
      WHERE CASE_DIV = @divisionCode
      AND (CLOSED_BY_COURT_DATE > 20180101 OR CLOSED_BY_UST_DATE > 20180101 OR (CLOSED_BY_COURT_DATE = 0 and CLOSED_BY_UST_DATE = 0))
      AND CONSOLIDATED_CASE_NUMBER = 0
      AND CONSOLIDATION_TYPE != ' '`;

    // Valid ACMS chapters: 09, 11, 12, 13, 15, 7A, 7N, AC
    // 'AC' is the predecessor to chapter 15. We are not importing these old cases into CAMS.
    // '7A' and '7N' are treated inclusively as chapter 7 cases when importing into CAMS.
    // Leading zero padding is added for chapter 9.

    if (predicate.chapter === '7') {
      query += ` AND CURR_CASE_CHAPT IN ('7A', '7N')`;
    } else {
      query += ` AND CURR_CASE_CHAPT = @chapter`;
      input.push({
        name: 'chapter',
        type: mssql.VarChar,
        value: ('00' + predicate.chapter).slice(-2),
      });
    }

    type ResultType = {
      leadCaseId: string;
    };

    context.logger.debug(MODULE_NAME, `Querying for parameters: ${JSON.stringify(input)}`);
    try {
      const { results } = await this.executeQuery<ResultType>(context, query, input);
      const leadCaseIdsResults = results as ResultType[];
      return leadCaseIdsResults.map((record) => record.leadCaseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, originalError.message);
    }
  }

  public async getConsolidationDetails(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidation> {
    const input: DbTableFieldSpec[] = [];
    input.push({
      name: `leadCaseId`,
      type: mssql.BigInt,
      value: leadCaseId,
    });

    const query = `
      SELECT
        CONCAT(
          RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3),
          '-',
          RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2),
          '-',
          RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
        ) AS caseId,
        CONSOLIDATION_DATE as consolidationDate,
        CONSOLIDATION_TYPE as consolidationType
      FROM [dbo].[CMMDB]
      WHERE CONSOLIDATED_CASE_NUMBER = @leadCaseId`;

    try {
      const results = await this.executeQuery<AcmsConsolidationChildCase>(context, query, input);
      const rawResults = results.results as AcmsConsolidationChildCase[];

      const formattedLeadCaseId = this.formatCaseId(leadCaseId);
      const childCases = rawResults
        .filter((bCase) => bCase.caseId !== formattedLeadCaseId)
        .map((bCase) => {
          const date = String(bCase.consolidationDate);
          return {
            ...bCase,
            consolidationType: bCase.consolidationType === 'S' ? 'substantive' : 'administrative',
            consolidationDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
          };
        });
      return {
        leadCaseId: this.formatCaseId(leadCaseId.toString()),
        childCases,
      };
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `Failed to get case info for lead case id: ${leadCaseId}.`,
        originalError,
      );
      throw getCamsError(originalError, MODULE_NAME, originalError.message);
    }
  }

  private formatCaseId(caseId: string): string {
    const padded = caseId.padStart(10, '0');
    return `${padded.slice(0, 3)}-${padded.slice(3, 5)}-${padded.slice(5)}`;
  }
}
