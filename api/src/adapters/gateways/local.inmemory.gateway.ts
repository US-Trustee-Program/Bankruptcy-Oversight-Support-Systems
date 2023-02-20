import log from '../logging.service';
import { RecordObj } from '../types/basic';
import { DbRecord } from '../types/database';
import mockData, { getProperty } from '../mock-data/';

const NAMESPACE = 'LOCAL-INMEMORY-DATA-MODULE';

function validateTableName(tableName: string) {}

async function query(table: string, data: Object): Promise<boolean | Object[][]> {
  const data = getProperty(mockData, table);
  //console.log(mockData[table]);
  return true;
}

const getAll = async (table: string): Promise<DbRecord> => {
  log('info', NAMESPACE, 'Get all chapters');

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  const results: DbRecord = {
    message: 'chapters list',
    count: 6,
    body: {
      7: 'Chapter 7',
      9: 'Chapter 9',
      11: 'Chapter 11',
      15: 'Chapter 15',
      17: 'Chapter 17',
      19: 'Chapter 19'
    },
    success: true
  };

  log('info', NAMESPACE, 'Chapter list found', results);

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbRecord> => {
  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  const results: DbRecord = {
    message: '',
    count: 0,
    body: {},
    success: true
  };

  return results;
};

const createRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Create record for ${table}`, fields);

  return true;
};

const updateRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  log('info', NAMESPACE, `Update record for ${table}`, fields);
  return true;
};

const deleteRecord = async (table: string, id: number): Promise<boolean> => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);
  return true;
};

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
