import { ApplicationContext } from '../types/basic';
import { caseListMockData, getProperty } from '../../testing/mock-data';
import { CaseListDbResult, CaseListRecordSet } from '../types/cases';
import { Chapter11GatewayInterface } from '../../use-cases/chapter-11.gateway.interface';
import { QueryResults } from '../types/database';
import log from '../services/logger.service';
import { runQuery } from './local.inmemory.gateway';

const NAMESPACE = 'CASES-LOCAL-INMEMORY-DB-GATEWAY';

const table = 'cases';

class Chapter11LocalGateway implements Chapter11GatewayInterface {
  private async initializeCases(): Promise<CaseListRecordSet> {
    let caseListRecords: CaseListRecordSet;

    if (caseListMockData.cases.initialized) {
      return caseListMockData[table];
    } else {
      caseListRecords = await getProperty(table, 'list');
      caseListRecords.initialized = true;
      caseListMockData[table] = caseListRecords;
    }

    return caseListRecords;
  }

  public async getCaseList(
    context: ApplicationContext,
    caseOptions: { chapter: string; professionalId: string } = { chapter: '', professionalId: '' },
  ): Promise<CaseListDbResult> {
    let caseListRecords: CaseListRecordSet;
    let input = [];

    caseListRecords = await this.initializeCases();

    log.info(context, NAMESPACE, `${caseOptions.chapter} ${caseOptions.professionalId}`);

    if (caseOptions.chapter.length > 0) {
      input.push({
        name: 'currentCaseChapter',
        value: caseOptions.chapter,
      });
    }

    if (caseOptions.professionalId.length > 0) {
      input.push({
        name: 'staff1ProfCode|staff2ProfCode',
        value: caseOptions.professionalId,
      });
    }

    const queryResult: QueryResults = await runQuery(
      context,
      'cases',
      caseListRecords.caseList,
      input,
    );
    let results: CaseListDbResult;

    if (queryResult.success) {
      log.info(context, NAMESPACE, 'Case List DB query successful');
      const body: CaseListRecordSet = { staff1Label: '', staff2Label: '', caseList: [] };
      // limit results to 20 records, as we are doing in the MSSQL database to temporarily prevent large result sets.
      let dbResults = Array.isArray(queryResult.results)
        ? [...queryResult.results].splice(0, 20)
        : queryResult.results;
      body.caseList = dbResults as Array<{}>;
      const rowsAffected = (dbResults as Array<{}>).length;
      results = {
        success: true,
        message: `${table} list`,
        count: rowsAffected,
        body,
      };
    } else {
      log.warn(context, NAMESPACE, 'Case List DB query unsuccessful');
      results = {
        success: false,
        message: queryResult.message,
        count: 0,
        body: { caseList: [] },
      };
    }

    return results;
  }
}

export { Chapter11LocalGateway };
