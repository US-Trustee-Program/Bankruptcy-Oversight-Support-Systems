import log from '../logging.service';
import { RecordObj } from '../types/basic';
import { DbRecord } from '../types/database';
import { getProperty } from '../mock-data/';

const NAMESPACE = 'LOCAL-INMEMORY-DATA-MODULE';

type ObjectStrKeyVal = {
  [key: string]: string;
}
type ObjectKeyValArrayKeyVal = {
  [key: string]: ObjectStrKeyVal[];
}

const mockData: ObjectKeyValArrayKeyVal = {};

function validateTableName(tableName: string) {
  return tableName.match(/^[a-z]+[a-z0-9]*$/i);
}

const getAll = async (table: string): Promise<DbRecord> => {
  let list: ObjectStrKeyVal[] = [];

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

  const results: DbRecord = {
    success: true,
    message: `${table} list`,
    count: list.length,
    body: list,
  };

  log('info', NAMESPACE, `list from ${table} found`, results);

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbRecord> => {
  let list: ObjectStrKeyVal = {};

  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  if (mockData.hasOwnProperty(table)) {
    const data = mockData[table].filter(rec => rec[`${table}_id`] == `${id}`).pop();
    if (data) list = data;
  }

  const results: DbRecord = {
    message: `${table} record`,
    count: 1,
    body: [list],
    success: true
  };

  log('info', NAMESPACE, `record from ${table} found`, results);

  return results;
};

const createRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Create record for ${table}`, fields);

  let newRecord: ObjectStrKeyVal = {};

  fields.map(field => {
    newRecord[field.fieldName] = field.fieldValue as string;
  });

  if (mockData.hasOwnProperty(table)) {
    mockData[table].push(newRecord);
    return true;
  } else {
    return false;
  }
};

const updateRecord = async (table: string, id: number, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Update record for ${table}`, fields);

  let newRecord: ObjectStrKeyVal = {};

  if (mockData.hasOwnProperty(table)) {
    for (let i = 0; i < mockData[table].length; i++) {
      let oldRecord = mockData[table][i];
      if (oldRecord[`${table}_id`] == `${id}`) {
        fields.map(field => {
          newRecord[field.fieldName] = field.fieldValue as string;
        });

        mockData[table][i] = newRecord;
      }
    }
    return true;
  } else {
    return false;
  }
};

const deleteRecord = async (table: string, id: number): Promise<boolean> => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);

  if (mockData.hasOwnProperty(table)) {
    const data = mockData[table].filter(rec => rec[`${table}_id`] != `${id}`);
    if (data) {
      mockData[table] = data;
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
