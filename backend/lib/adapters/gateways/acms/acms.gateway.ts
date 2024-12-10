import * as mssql from 'mssql';
import {
  AcmsConsolidation,
  AcmsConsolidationChildCase,
  AcmsPredicate,
  AcmsPredicateAndPage,
} from '../../../use-cases/acms-orders/acms-orders';
import { AcmsGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { AbstractMssqlClient } from '../abstract-mssql-client';
import { getCamsError } from '../../../common-errors/error-utilities';
import { DbTableFieldSpec } from '../../types/database';

const MODULE_NAME = 'ACMS_GATEWAY';
const PAGE_SIZE = 10;

export class AcmsGatewayImpl extends AbstractMssqlClient implements AcmsGateway {
  constructor(context: ApplicationContext) {
    // The context carries different database connection configurations.
    // We pick off the configuration specific to this ACMS gateway.
    const config = context.config.acmsDbConfig;
    super(config, MODULE_NAME);
  }

  async getPageCount(context: ApplicationContext, predicate: AcmsPredicate): Promise<number> {
    const input: DbTableFieldSpec[] = [];
    let query = `
      SELECT COUNT(DISTINCT CONSOLIDATED_CASE_NUMBER) AS leadCaseCount
      FROM [dbo].[CMMDB]
      WHERE CASE_DIV = @divisionCode
      AND CLOSED_BY_COURT_DATE = '0' OR CLOSED_BY_COURT_DATE > '20170101'
      AND CONSOLIDATED_CASE_NUMBER != '0'`;

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

    input.push({
      name: 'divisionCode',
      type: mssql.VarChar,
      value: predicate.divisionCode,
    });

    type ResultType = {
      leadCaseCount: number;
    };

    try {
      const results = await this.executeQuery<ResultType>(context, query, input);
      // TODO: handle falsy result
      const result = results.results[0];
      return result.leadCaseCount ? Math.ceil(result.leadCaseCount / PAGE_SIZE) : 0;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, originalError.message);
    }
  }

  async getLeadCaseIds(
    context: ApplicationContext,
    predicateAndPage: AcmsPredicateAndPage,
  ): Promise<string[]> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'divisionCode',
      type: mssql.VarChar,
      value: predicateAndPage.divisionCode,
    });

    input.push({
      name: `limit`,
      type: mssql.Int,
      value: PAGE_SIZE,
    });

    input.push({
      name: `offset`,
      type: mssql.Int,
      value: PAGE_SIZE * (predicateAndPage.pageNumber - 1),
    });

    let query = `
      SELECT DISTINCT CONSOLIDATED_CASE_NUMBER AS leadCaseId
      FROM [dbo].[CMMDB]
      WHERE CASE_DIV = @divisionCode
      AND CLOSED_BY_COURT_DATE = '0' OR CLOSED_BY_COURT_DATE > '20170101'
      AND CONSOLIDATED_CASE_NUMBER != '0'`;

    // Valid ACMS chapters: 09, 11, 12, 13, 15, 7A, 7N, AC
    // 'AC' is the predecesor to chapter 15. We are not importing these old cases into CAMS.
    // '7A' and '7N' are treated inclusively as chapter 7 cases when importing into CAMS.
    // Leading zero padding is added for chapter 9.

    if (predicateAndPage.chapter === '7') {
      query += ` AND CURR_CASE_CHAPT IN ('7A', '7N')`;
    } else {
      query += ` AND CURR_CASE_CHAPT = @chapter`;
      input.push({
        name: 'chapter',
        type: mssql.VarChar,
        value: ('00' + predicateAndPage.chapter).slice(-2),
      });
    }

    query += ` ORDER BY CONSOLIDATED_CASE_NUMBER DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    type ResultType = {
      leadCaseId: string;
    };

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
