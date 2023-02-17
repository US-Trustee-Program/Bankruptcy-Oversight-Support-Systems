import * as mssql from 'mssql';
import config from '../configs/default.config';
import { Connect, Query } from '../mssql.service';
import { Connection } from 'tedious';
import log from '../logging.service';
import { RecordObj, DbRecord } from '../types/basic';
import { PersistenceGateway } from '../../use-cases/persistence-gateway.int';
import { DefaultAzureCredential } from '@azure/identity';

type QueryResults = {
  results: void | Object;
  message: string;
  success: boolean;
}

const NAMESPACE = 'AZURE-SQL-MODULE';

const credential = new DefaultAzureCredential({ managedIdentityClientId: config.dbConfig.azureManagedIdentity }); // user-assigned identity

const Connect = async () =>
  new Promise<mssql.ConnectionPool>(async (resolve, reject) => {
    try {
      const connection: mssql.ConnectionPool = await mssql.connect(config.dbConfig);
      resolve(connection);
    } catch (error) {
      reject(error);
      return;
    }
  });

const Query = async (connection: mssql.ConnectionPool, query: string) =>
  new Promise((resolve, reject) => {
    log('info', 'MSSQL', `Query: ${query}`, connection);
    const request = new mssql.Request(connection);

    try {
      const result = request.query(query);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });

function validateTableName (tableName: string) {
  return true;
}

function runQuery(tableName: string, query: string): QueryResults {
  // we should do some sanitization here to eliminate sql injection issues

  const result = async (): Promise<QueryResults> => {
    const queryResult: QueryResults = await Connect()
      .then((connection: Connection) => {
        Query(connection, query)
          .then((results) => {
            log('info', NAMESPACE, `Retrieved ${tableName}: `, results);

            const queryResult: QueryResults = {
              results,
              message: '',
              success: true
            };

            return queryResult;
          })
          .catch((error: Error) => {
            log('error', NAMESPACE, error.message, error);

            const queryResult: QueryResults = {
              results: {},
              message: error.message,
              success: false
            };

            return queryResult;
          })
          .finally(() => {
            log('info', NAMESPACE, 'Closing connection.');
            connection.close();
          });
      })
      .catch((error: Error) => {
        log('error', NAMESPACE, error.message, error);

        const queryResult: QueryResults = {
          results: {},
          message: error.message,
          success: false
        };

        return queryResult;
      });
    return queryResult;
  }

  try {
  result().then((val) => {
    return val});
  }
  catch(err) {
    throw new Error('No results returned from database');
  }
}

const getAll = (table: string): DbRecord => {
  let query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = runQuery(table, query);
  let results: DbRecord;
  
  if (queryResult.success) {
    results = {
      message: `${table} list`,
      count: 0,
      body: queryResult,
      success: true,
    }
  } else {
    results = {
      message: queryResult.message,
      count: 0,
      body: queryResult,
      success: false,
    }
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