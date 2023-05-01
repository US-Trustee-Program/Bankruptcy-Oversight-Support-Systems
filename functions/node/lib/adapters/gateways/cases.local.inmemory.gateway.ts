import log from '../services/logger.service';
import { caseListMockData, getProperty } from '../../testing/mock-data/';
import { Context } from '../types/basic';
import { RecordObj } from '../types/basic';
import { DbResult, QueryResults } from '../types/database';
import { CaseListRecordSet } from '../types/cases';
import { validateTableName, runQuery } from './local.inmemory.gateway';
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

const getCaseList = async (context: Context, caseOptions: {chapter: string, professionalId: number} = {chapter: '', professionalId: 0}): Promise<DbResult> => {
  let caseListRecords: CaseListRecordSet;
  let input = [];

  caseListRecords = await initializeCases();

  log.info(context, NAMESPACE, `${caseOptions.chapter} ${caseOptions.professionalId}`);

  if (caseOptions.chapter.length > 0) {
    input.push(
      {
        name: 'chapt',
        value: caseOptions.chapter,
      },
    );
  }
  if (caseOptions.professionalId > 0) {
    input.push(
      {
        name: 'professionalId',
        value: caseOptions.professionalId
      },
    );
  }

  const queryResult: QueryResults = await runQuery(context, '', caseListRecords.caseList, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(context, NAMESPACE, 'Case List DB query successful');
    const body = { staff1Label: '', staff2Label: '', caseList: {} }
    body.caseList = queryResult.results as Object;
    const rowsAffected = (queryResult.results as Array<{}>).length;
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

const getCase = async (context: Context, id: number): Promise<DbResult> => {
  return await getRecord(context, table, id);
};

const createCase = async (context: Context, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await createRecord(context, table, fieldArr);
};

const updateCase = async (context: Context, id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await updateRecord(context, table, id, fieldArr);
};

const deleteCase = async (context: Context, id: number): Promise<DbResult> => {
  return await deleteRecord(context, table, id);
};

export { getCaseList, getCase, createCase, updateCase, deleteCase };
