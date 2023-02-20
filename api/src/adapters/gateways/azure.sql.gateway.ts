import * as mssql from 'mssql';
import config from '../../configs/default.config';
import log from '../logging.service';
import { RecordObj } from '../types/basic';
import { DbRecord, QueryResults } from '../types/database';
import { DefaultAzureCredential } from '@azure/identity';

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

function validateTableName(tableName: string) {
  return true;
}

async function runQuery(tableName: string, query: string): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  try {
    const connection: mssql.ConnectionPool = await Connect();
    const results = Query(connection, query);

    log('info', NAMESPACE, `Retrieved ${tableName}: `, results);

    const queryResult: QueryResults = {
      results,
      message: '',
      success: true
    };

    log('info', NAMESPACE, 'Closing connection.');
    connection.close();

    return queryResult;
  } catch (error) {
    log('error', NAMESPACE, (error as Error).message, error);

    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false
    };

    return queryResult;
  }
}

const getAll = async (table: string): Promise<DbRecord> => {
  let query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = await runQuery(table, query);
  let results: DbRecord;

  if (queryResult.success) {
    results = {
      message: `${table} list`,
      count: 0,
      body: queryResult,
      success: true
    };
  } else {
    results = {
      message: queryResult.message,
      count: 0,
      body: queryResult,
      success: false
    };
  }

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbRecord> => {
  let query = `SELECT * FROM ${table} WHERE id = '${id}'`;
  const queryResult = runQuery(table, query);

  const results: DbRecord = {
    message: '',
    count: 1,
    body: queryResult,
    success: true
  };

  return results;
};

const createRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  let fieldNameArr = [];
  let fieldValueArr = [];

  for (const fieldName in fields) {
    fieldNameArr.push(fieldName);
    fieldValueArr.push(fields[fieldName]);
  }

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES ()`;

  return true;
};

const updateRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  let fieldNameArr = [];
  let fieldValueArr = [];

  for (const fieldName in fields) {
    fieldNameArr.push(fieldName);
    fieldValueArr.push(fields[fieldName]);
  }

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES ()`;

  return true;
};

const deleteRecord = async (table: string, id: number): Promise<boolean> => {
  log('info', NAMESPACE, `Deleting record ${id} from ${table}`);

  return true;
};

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
