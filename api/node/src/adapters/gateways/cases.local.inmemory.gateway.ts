import log from '../logging.service.js';
import { caseListMockData, getProperty, mockData } from '../mock-data/';
import { ObjectKeyVal, RecordObj } from '../types/basic.js';
import { CaseListRecordSet } from '../types/cases.js';
import { DbResult } from '../types/database.js';
import { createRecord, validateTableName } from './local.inmemory.gateway.js';

const NAMESPACE = 'CASES-LOCAL-INMEMORY-DATA-MODULE';

const table = 'cases';

async function initializeCases(): Promise<CaseListRecordSet> {
  let caseList: CaseListRecordSet;

  if (caseListMockData.cases.initialized) {
    return caseListMockData[table];
  } else {
    caseList = await getProperty(table, 'list');
    caseList.initialized = true;
    caseListMockData[table] = caseList;
  }

  return caseList;
}

const getCaseList = async (): Promise<DbResult> => {
  let caseListRecords: CaseListRecordSet;

  log('info', NAMESPACE, `Get all from ${table}`);

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  caseListRecords = await initializeCases();

  const results: DbResult = {
    success: true,
    message: `${table} list`,
    count: caseListRecords.caseList.length,
    body: caseListRecords,
  };

  log('info', NAMESPACE, `list from ${table} found`, results);

  return results;
};

const getCase = async (id: number): Promise<DbResult> => {
  let caseListRecords: CaseListRecordSet;
  let record: ObjectKeyVal = {};
  let results: DbResult;

  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  caseListRecords = await initializeCases();

  const data = caseListRecords.caseList.filter((rec) => rec['caseDiv'] == `${id}`).pop();
  if (data) {
    log('info', NAMESPACE, `record from ${table} found`, data);
    results = {
      message: `${table} record`,
      count: 1,
      body: [data],
      success: true,
    };
  } else {
    results = {
      message: `record not found`,
      count: 0,
      body: {},
      success: false,
    };
  }

  return results;
};

const createCase = async (fieldArr: RecordObj[]): Promise<DbResult> => {
  return await createRecord(table, fieldArr);
};

const updateCase = async (id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  log('info', NAMESPACE, `Update record for ${table}`, fieldArr);

  let newRecord: ObjectKeyVal = {};

  if (mockData.hasOwnProperty(table)) {
    for (let i = 0; i < mockData[table].length; i++) {
      log('info', NAMESPACE, `Searching for ${id}`);
      let oldRecord = mockData[table][i];
      if (oldRecord[`caseDiv`] == id) {
        log('info', NAMESPACE, 'record found', oldRecord);
        newRecord[`caseDiv`] = id;
        fieldArr.map((field) => {
          newRecord[field.fieldName] = field.fieldValue as string;
        });

        log('info', NAMESPACE, `New record: `, newRecord);
        mockData[table][i] = newRecord;
      }
    }
    return {
      success: true,
      count: 1,
      message: '',
      body: newRecord,
    };
  } else {
    return {
      success: false,
      count: 0,
      message: `data ${table} could not be found.`,
      body: {},
    };
  }
};

const deleteCase = async (id: number): Promise<DbResult> => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);

  if (mockData.hasOwnProperty(table)) {
    const data = mockData[table].filter((rec) => rec[`caseDiv`] != id);
    if (data) {
      mockData[table] = data;
      return {
        success: true,
        count: 1,
        message: `Record ${id} successfully deleted`,
        body: {},
      };
    } else {
      return {
        success: false,
        count: 0,
        message: `Record ${id} could not be deleted`,
        body: {},
      };
    }
  } else {
    return {
      success: false,
      count: 0,
      message: `Record ${id} could not be found`,
      body: {},
    };
  }
};

export { getCaseList, getCase, createCase, updateCase, deleteCase };
