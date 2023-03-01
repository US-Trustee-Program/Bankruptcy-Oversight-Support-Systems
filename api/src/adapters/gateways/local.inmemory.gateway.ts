import log from '../logging.service';
import { ObjectKeyVal, ObjectKeyValArrayKeyVal, RecordObj } from '../types/basic';
import { DbResult } from '../types/database';
import { getProperty, mockData } from '../mock-data/';

const NAMESPACE = 'LOCAL-INMEMORY-DATA-MODULE';

function validateTableName(tableName: string) {
  return tableName.match(/^[a-z]+[a-z0-9]*$/i);
}

const getAll = async (table: string): Promise<DbResult> => {
  let list: ObjectKeyVal[] = [];

  log('info', NAMESPACE, `Get all from ${table}`);

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  if (mockData.hasOwnProperty(table)) {
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

  log('info', NAMESPACE, `list from ${table} found`, results);

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbResult> => {
  let list: ObjectKeyVal[] = [];
  let record: ObjectKeyVal = {};

  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  if (mockData.hasOwnProperty(table)) {
    list = mockData[table];
  } else {
    list = await getProperty(table, 'list');
    mockData[table] = list;
  }

  if (mockData.hasOwnProperty(table)) {
    const data = list.filter((rec) => rec[`${table.toLowerCase()}_id`] == `${id}`).pop();
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

const createRecord = async (table: string, fields: RecordObj[]): Promise<DbResult> => {
  log('info', NAMESPACE, `Create record for ${table}`, fields);

  let newRecord: ObjectKeyVal = {};

  // if mock data is not preloaded, populate data from mock
  if (!mockData.hasOwnProperty(table)) {
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

  if (mockData.hasOwnProperty(table)) {
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

const updateRecord = async (table: string, id: number, fields: RecordObj[]): Promise<DbResult> => {
  log('info', NAMESPACE, `Update record for ${table}`, fields);

  let newRecord: ObjectKeyVal = {};

  if (mockData.hasOwnProperty(table)) {
    for (let i = 0; i < mockData[table].length; i++) {
      console.log(`Searching for ${id}`);
      let oldRecord = mockData[table][i];
      if (oldRecord[`${table}_id`] == id) {
        console.log('record found', oldRecord);
        newRecord[`${table}_id`] = id;
        fields.map((field) => {
          newRecord[field.fieldName] = field.fieldValue as string;
        });

        console.log(`New record: `, newRecord);
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

const deleteRecord = async (table: string, id: number): Promise<DbResult> => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);

  if (mockData.hasOwnProperty(table)) {
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

export { createRecord, getAll, getRecord, updateRecord, deleteRecord, validateTableName };
