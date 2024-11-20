import * as mssql from 'mssql';
import { Predicate, PredicateAndPage } from '../../../use-cases/acms-orders/acms-orders';
import { AcmsGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { AbstractDbClient } from '../mssql';
import { getCamsError } from '../../../common-errors/error-utilities';
import { DbTableFieldSpec } from '../../types/database';

const MODULE_NAME = 'ACMS_GATEWAY';
const PAGE_SIZE = 50;

export class AcmsGatewayImpl extends AbstractDbClient implements AcmsGateway {
  constructor(context: ApplicationContext) {
    // The context carries different database connection configurations.
    // We pick off the configuration specific to this ACMS gateway.
    const config = context.config.acmsDbConfig;
    super(context, config, MODULE_NAME);
  }

  async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    const input: DbTableFieldSpec[] = [];

    // TODO: map from string chapters that accept numbers to be two character strings
    // 09, 11, 12, 13, 15, 7A, 7N, AC
    input.push({
      name: 'chapter',
      type: mssql.VarChar,
      value: predicate.chapter,
    });

    input.push({
      name: 'divisionCode',
      type: mssql.VarChar,
      value: predicate.divisionCode,
    });

    type ResultType = {
      leadCaseCount: number;
    };

    const query = `SELECT COUNT(DISTINCT CONSOLIDATED_CASE_NUMBER) as leadCaseCount
      from CMMDB
      where CURR_CASE_CHAPT = @chapter
      and CASE_DIV = @divisionCode
      and CLOSED_BY_COURT_DATE = '0' OR CLOSED_BY_COURT_DATE > '20170101'
      and CONSOLIDATED_CASE_NUMBER != '0'`;

    try {
      const results = await this.executeQuery<ResultType>(context, query, input);
      const result = results.results[0];
      return result.leadCaseCount ? Math.ceil(result.leadCaseCount / PAGE_SIZE) : 0;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getLeadCaseIds(
    context: ApplicationContext,
    predicateAndPage: PredicateAndPage,
  ): Promise<string[]> {
    const input: DbTableFieldSpec[] = [];

    // TODO: map from string chapters that accept numbers to be two character strings
    // 09, 11, 12, 13, 15, 7A, 7N, AC
    input.push({
      name: 'chapter',
      type: mssql.VarChar,
      value: predicateAndPage.chapter,
    });

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

    const query = `SELECT DISTINCT RIGHT(CONCAT('000', CAST(CONSOLIDATED_CASE_NUMBER AS VARCHAR)), 10) as leadCaseId
      from CMMDB
      where CURR_CASE_CHAPT = @chapter
      and CASE_DIV = @divisionCode
      and CLOSED_BY_COURT_DATE = '0' OR CLOSED_BY_COURT_DATE > '20170101'
      and CONSOLIDATED_CASE_NUMBER != '0'
      ORDER BY CONSOLIDATED_CASE_NUMBER DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    type ResultType = {
      leadCaseId: string;
    };

    try {
      const results = await this.executeQuery<ResultType>(context, query, input);
      // TODO: Fix this.
      const theFrackingList = results.results as ResultType[];
      return theFrackingList.map((record) => record.leadCaseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
