import { Connect, Query } from '../mssql.service';
import { Connection } from 'tedious';
import log from '../logging.service';
import { RecordObj, DbRecord } from '../types/basic';
import { PersistenceGateway } from '../../use-cases/persistence-gateway.int';

const NAMESPACE = 'AZURE-SQL-MODULE';

function validateTableName (tableName: string) {
  return true;
}

function runQuery(tableName: string, query: string): {} {
  // we should do some sanitization here to eliminate sql injection issues

  return Connect()
    .then((connection: Connection) => {
      Query(connection, query)
        .then((results) => {
          log('info', NAMESPACE, `Retrieved ${tableName}: `, results);

          return {
            results,
            message: '',
            success: true
          };
        })
        .catch((error: Error) => {
          log('error', NAMESPACE, error.message, error);

          return {
            results: {},
            message: error.message,
            success: false
          };
        })
        .finally(() => {
          log('info', NAMESPACE, 'Closing connection.');
          connection.close();
        });
    })
    .catch((error: Error) => {
      log('error', NAMESPACE, error.message, error);

      return {
        results: {},
        message: error.message,
        success: false
      };
    });
}

const getAll = (table: string): DbRecord => {
  let query = `SELECT * FROM ${table}`;
  const queryResult = runQuery(table, query);
  
  const results: DbRecord = {
    message: '',
    count: 6,
    body: {},
    success: true
  }

  return results;
}

const getRecord = (table: string, id: number): DbRecord => {
  let query = `SELECT * FROM ${table} WHERE id = '${id}'`;
  const queryResult = runQuery(table, query);

  const results: DbRecord = {
    message: '',
    count: 6,
    body: {},
    success: true
  }

  return results;
}

const createRecord = (table: string, fields: RecordObj[]): boolean => {
  let fieldNameArr = [];
  let fieldValueArr = []

  for(const fieldName in fields) {
    fieldNameArr.push(fieldName);
    fieldValueArr.push(fields[fieldName]);
  }

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES ()`;
  return true;
}

const updateRecord = (table: string, fields: RecordObj[]): boolean => {
  let fieldNameArr = [];
  let fieldValueArr = []

  for(const fieldName in fields) {
    fieldNameArr.push(fieldName);
    fieldValueArr.push(fields[fieldName]);
  }

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES ()`;
  return true;
}

const deleteRecord = (table: string, id: number): boolean => {
  log('info', NAMESPACE, `Deleting record ${id} from ${table}`);

  return true;
}

export {
  createRecord, getAll, getRecord, updateRecord, deleteRecord
}