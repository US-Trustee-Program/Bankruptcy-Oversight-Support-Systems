import log from '../logging.service';
import { DbRecord, RecordObj } from '../types/basic';

const NAMESPACE = 'LOCAL-INMEMORY-DATA-MODULE';

function validateTableName (tableName: string) {
  return true;
}

const getAll = (table: string): DbRecord => {
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

  return results;
}

const getRecord = (table: string, id: number): DbRecord => {
  log('info', NAMESPACE, `Fetch record ${id} from ${table}`);

  const results: DbRecord = 
    {
      message: '',
      count: 0,
      body: {},
      success: true,
    };

  return results;
}

const createRecord = (table: string, fields: RecordObj[]): boolean => {
  log('info', NAMESPACE, `Create record for ${table}`, fields);

  return true;
}

const updateRecord = (table: string, fields: RecordObj[]): boolean => {
  log('info', NAMESPACE, `Update record for ${table}`, fields);

  return true;
}

const deleteRecord = (table: string, id: number): boolean => {
  log('info', NAMESPACE, `Delete record ${id} for ${table}`);

  return true;
}

export {
  createRecord, getAll, getRecord, updateRecord, deleteRecord
}
