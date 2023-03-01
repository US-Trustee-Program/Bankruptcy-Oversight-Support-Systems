import log from '../logging.service';
import { getProperty, mockData } from '../mock-data';
import { ObjectKeyVal, RecordObj } from '../types/basic';
import { DbResult } from '../types/database';
import { createRecord, updateRecord, deleteRecord, validateTableName } from './local.inmemory.gateway';

const NAMESPACE = 'CASES-LOCAL-INMEMORY-DATA-MODULE';

const table = 'cases';

async function initializeCases(): Promise<ObjectKeyVal[]> {
  let caseList: ObjectKeyVal[] = [];
  let chaptersList: string[] = [];

  mockData['chapters'] = await getProperty('chapters', 'list');
  caseList = await getProperty(table, 'list');
  for (let i = 0; i < mockData['chapters'].length; i++) {
    chaptersList.push(mockData['chapters'][i].chapter_name as string);
  }
  caseList.forEach((rec: ObjectKeyVal) => {
    const chapterId = rec['chapters_id'];
    rec['chapter_title'] = chaptersList[+chapterId];
  });
  return caseList;
}

const getCaseList = async (): Promise<DbResult> => {
  let caseList: ObjectKeyVal[] = [];

  log('info', NAMESPACE, `Get all from ${table}`);

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  if (mockData.hasOwnProperty(table)) {
    caseList = mockData[table];
  } else {
    caseList = await initializeCases();
    mockData[table] = caseList;
  }

  const results: DbResult = {
    success: true,
    message: `${table} list`,
    count: caseList.length,
    body: caseList,
  };

  log('info', NAMESPACE, `list from ${table} found`, results);

  return results;
};

const getCase = async (id: number): Promise<DbResult> => {
  let caseList: ObjectKeyVal[] = [];
  let record: ObjectKeyVal = {};
  let chaptersList: string[] = [];

  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  if (mockData.hasOwnProperty(table)) {
    caseList = mockData[table];
  } else {
    caseList = await initializeCases();
    mockData[table] = caseList;
  }

  if (mockData.hasOwnProperty(table)) {
    const data = caseList.filter((rec) => rec[`${table.toLowerCase()}_id`] == `${id}`).pop();
    if (data) record = data;
  }

  const results: DbResult = {
    message: `${table} record`,
    count: 1,
    body: [record],
    success: true,
  };

  log('info', NAMESPACE, `record from ${table} found`, results);

  return results;
};

const createCase = async (fieldArr: RecordObj[]): Promise<DbResult> => {
  return await createRecord(table, fieldArr);
};

const updateCase = async (id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  return await updateRecord(table, id, fieldArr);
};

const deleteCase = async (id: number): Promise<DbResult> => {
  return await deleteRecord(table, id);
};

export { getCaseList, getCase, createCase, updateCase, deleteCase };
