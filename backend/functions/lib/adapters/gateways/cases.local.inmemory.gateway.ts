import log from '../services/logger.service';
import { caseListMockData, getProperty } from '../../testing/mock-data';
import { ApplicationContext } from '../types/basic';
import { DbResult, QueryResults } from '../types/database';
import { CaseListRecordSet } from '../types/cases';
import { runQuery } from './local.inmemory.gateway';
import { getRecord, createRecord, updateRecord, deleteRecord } from './local.inmemory.gateway';

const NAMESPACE = 'CASES-LOCAL-INMEMORY-DB-GATEWAY';

const table = 'cases';

async function initializeCases(): Promise<CaseListRecordSet> {
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

const getCaseList = async (
  context: ApplicationContext,
  caseOptions: { chapter: string; professionalId: string } = { chapter: '', professionalId: '' },
): Promise<DbResult> => {
  let caseListRecords: CaseListRecordSet;
  let input = [];

  caseListRecords = await initializeCases();

  log.info(context, NAMESPACE, `${caseOptions.chapter} ${caseOptions.professionalId}`);

  if (caseOptions.chapter && caseOptions.chapter.length > 0) {
    input.push({
      name: 'currentCaseChapter',
      value: caseOptions.chapter,
    });
  }
  if (caseOptions.professionalId && caseOptions.professionalId.length > 0) {
    input.push({
      name: 'staff1ProfCode|staff2ProfCode',
      value: caseOptions.professionalId,
    });
  }

  const queryResult: QueryResults = await runQuery(context, '', caseListRecords.caseList, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(context, NAMESPACE, 'Case List DB query successful');
    const body = { staff1Label: '', staff2Label: '', caseList: {} };
    // limit results to 20 records, as we are doing in the MSSQL database to temporarily prevent large result sets.
    let dbResults = Array.isArray(queryResult.results)
      ? [...queryResult.results].splice(0, 20)
      : queryResult.results;
    body.caseList = dbResults as Object;
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
      body: {},
    };
  }

  return results;
};

export { getCaseList };
