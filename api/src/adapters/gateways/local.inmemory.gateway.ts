/*
 * Refactor this code to manage an in-memory data object.  Only the initial retrieve list needs to load the default data.
 * All other interaction should use an in memory data system.
 */

import log from '../logging.service';
import { RecordObj } from '../types/basic';
import { DbRecord } from '../types/database';
import { getProperty } from '../mock-data/';

const NAMESPACE = 'LOCAL-INMEMORY-DATA-MODULE';

function validateTableName(tableName: string) {}

async function query(table: string, item: string): Promise<boolean | Object[][]> {
  return await getProperty(table, item);
}

const getAll = async (table: string): Promise<DbRecord> => {
  log('info', NAMESPACE, `Get all from ${table}`);

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  const list = await getProperty(table, 'list');

  const results: DbRecord = {
    message: `${table} list`,
    count: list.length,
    body: list,
    success: true
  };

  log('info', NAMESPACE, `list from ${table} found`, results);

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbRecord> => {
  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  const list = await getProperty(table, 'oneRecord');

  const results: DbRecord = {
    message: `${table} record`,
    count: list.length,
    body: list,
    success: true
  };

  log('info', NAMESPACE, `record from ${table} found`, results);

  return results;
};

const createRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Create record for ${table}`, fields);

  return true;
};

const updateRecord = async (table: string, id: number, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Update record for ${table}`, fields);
  return true;
};

const deleteRecord = async (table: string, id: number): Promise<boolean> => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);
  return true;
};

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
