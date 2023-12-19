import log from '../services/logger.service';
import { ApplicationContext, ObjectKeyVal, RecordObj } from '../types/basic.js';
import { DbResult, QueryResults } from '../types/database.js';
import { getProperty, mockData } from '../../testing/mock-data';

const MODULE_NAME = 'INMEMORY-DATA-MODULE';

const runQuery = async (
  applicationContext: ApplicationContext,
  tableName: string,
  mockData: ObjectKeyVal[],
  input: { name: string; value: string }[],
): Promise<QueryResults> => {
  log.info(applicationContext, MODULE_NAME, `Mocking query for ${tableName}`, input);

  const queryResult = mockData.filter((obj: object) => {
    let result = true;
    input.forEach((key) => {
      const keyArr = key['name'].split('|');
      if (keyArr.length > 1) {
        let subResult = false;
        keyArr.forEach((subKey) => {
          if (Object.prototype.hasOwnProperty.call(obj, subKey) && obj[subKey] == key['value']) {
            subResult = true;
          }
        });
        result = result && subResult;
      } else {
        if (
          !(
            Object.prototype.hasOwnProperty.call(obj, key['name']) &&
            obj[key['name']] == key['value']
          )
        ) {
          result = false;
        }
      }
    });
    return result;
  });

  // return success
  return {
    success: true,
    message: `Successfully return results from query to ${tableName}`,
    results: queryResult,
  };
};

const getAll = async (applicationContext: ApplicationContext, table: string): Promise<DbResult> => {
  let list: ObjectKeyVal[] = [];

  log.info(applicationContext, MODULE_NAME, `Get all from ${table}`);

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    list = mockData[table];
  } else {
    list = await getProperty(table, 'list');
    mockData[table] = list;
  }

  const results: DbResult = {
    success: true,
    message: `${table} list`,
    count: list.length,
    body: list,
  };

  return results;
};

const getRecord = async (
  applicationContext: ApplicationContext,
  table: string,
  id: number,
): Promise<DbResult> => {
  let list: ObjectKeyVal[] = [];
  let record: ObjectKeyVal = {};

  log.info(applicationContext, MODULE_NAME, `Fetch record ${id} from ${table}`);

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    list = mockData[table];
  } else {
    list = await getProperty(table, 'list');
    mockData[table] = list;
  }

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    const data = list.filter((rec) => rec[`${table.toLowerCase()}_id`] == `${id}`).pop();
    if (data) record = data;
  }

  const results: DbResult = {
    message: `${table} record`,
    count: 1,
    body: [record],
    success: true,
  };

  log.info(applicationContext, MODULE_NAME, `record from ${table} found`, results);

  return results;
};

const createRecord = async (
  applicationContext: ApplicationContext,
  table: string,
  fields: RecordObj[],
): Promise<DbResult> => {
  log.info(applicationContext, MODULE_NAME, `Create record for ${table}`, fields);

  const newRecord: ObjectKeyVal = {};

  // if mock data is not preloaded, populate data from mock
  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    mockData[table] = await getProperty(table, 'list');
  }

  // fetch a new ID by scanning all existing id's and finding the biggest number, then incrementing
  let id = 1;
  mockData[table].forEach((rec) => {
    if (+rec[`${table}_id`] > id) {
      id = +rec[`${table}_id`];
    }
  });
  id++;
  newRecord[`${table}_id`] = id;

  fields.map((field) => {
    newRecord[field.fieldName] = field.fieldValue as string;
  });

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    mockData[table].push(newRecord);
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

const updateRecord = async (
  applicationContext: ApplicationContext,
  table: string,
  id: number,
  fields: RecordObj[],
): Promise<DbResult> => {
  log.info(applicationContext, MODULE_NAME, `Update record for ${table}`, fields);

  const newRecord: ObjectKeyVal = {};

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    for (let i = 0; i < mockData[table].length; i++) {
      log.info(applicationContext, MODULE_NAME, `Searching for ${id}`);
      const oldRecord = mockData[table][i];
      if (oldRecord[`${table}_id`] == id) {
        log.info(applicationContext, MODULE_NAME, 'record found', oldRecord);
        newRecord[`${table}_id`] = id;
        fields.map((field) => {
          newRecord[field.fieldName] = field.fieldValue as string;
        });

        log.info(applicationContext, MODULE_NAME, `New record: `, newRecord);
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

const deleteRecord = async (
  applicationContext: ApplicationContext,
  table: string,
  id: number,
): Promise<DbResult> => {
  log.info(applicationContext, MODULE_NAME, `Delete record ${id} for ${table}`);

  if (Object.prototype.hasOwnProperty.call(mockData, table)) {
    const data = mockData[table].filter((rec) => rec[`${table}_id`] != id);
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

export { createRecord, getAll, getRecord, updateRecord, deleteRecord, runQuery };
