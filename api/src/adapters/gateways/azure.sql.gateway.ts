import mssql, { ISqlType } from 'mssql';
import config from '../../configs/default.config';
import log from '../logging.service';
import { RecordObj } from '../types/basic';
import { DbRecord, QueryResults } from '../types/database';
import { DefaultAzureCredential } from '@azure/identity';

const NAMESPACE = 'AZURE-SQL-MODULE';

//const credential = new DefaultAzureCredential({ managedIdentityClientId: config.dbConfig.azureManagedIdentity }); // user-assigned identity

function validateTableName(tableName: string) {
  return true;
}

type DBTableFieldSpec = {
  name: string;
  type: mssql.ISqlTypeFactoryWithNoParams;
  value: any;
}

async function runQuery(tableName: string, query: string, input?: DBTableFieldSpec[]): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues
  if (!validateTableName(tableName)) {
    throw new Error(`Invalid table name ${tableName}`);
  }

  try {
    const pool = new mssql.ConnectionPool(config.dbConfig);
    const connection = await pool.connect();

    log('info', 'MSSQL', `Query: ${query}`);

    const request = await connection.request();

    if (typeof input != "undefined") {
      input.forEach(item => {
        request.input(item.name, item.type, item.value);
      });
    }
    const results = await request.query(query);

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
  const query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = await runQuery(table, query);
  let results: DbRecord;

  if (queryResult.success) {
    const records = (queryResult.results as mssql.IResult<any>).recordset;
    const rowsAffected = (queryResult.results as mssql.IResult<any>).rowsAffected[0];
    results = {
      success: true,
      message: `${table} list`,
      count: rowsAffected,
      body: records, 
    };
  } else {
    results = {
      success: false,
      message: queryResult.message,
      count: 0,
      body: {},
    };
  }

  return results;
};

const getRecord = async (table: string, id: number): Promise<DbRecord> => {
  let query = `SELECT * FROM ${table} WHERE id = @id`;
  let results: DbRecord;
  const input: DBTableFieldSpec[] = [{
    name: 'id',
    type: mssql.Int,
    value: id,
  }]
  const queryResult = await runQuery(table, query, input);

  if (queryResult.success) {
    results = {
      message: '',
      count: 1,
      body: (queryResult.results as mssql.IResult<any>).recordset,
      success: true
  };
  } else {
    results = {
      message: queryResult.message,
      count: 0,
      body: {},
      success: false
    };
  }

  return results;
};

const createRecord = async (table: string, fields: RecordObj[]): Promise<boolean> => {
  let fieldNameArr = [];
  let fieldValueArr = [];

  for (const fieldName in fields) {
    fieldNameArr.push(fieldName);
    fieldValueArr.push("'" + fields[fieldName] + "'");
  }

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES (${fieldValueArr.join(',')})`;

  const queryResult = runQuery(table, query);

  return Boolean(queryResult);
};

const updateRecord = async (table: string, id: number, fields: RecordObj[]): Promise<boolean> => {
  let nameValuePairs = [];

  for (const fieldName in fields) {
    nameValuePairs.push(fieldName + "='" + fields[fieldName] + "'");
  }

  const query = `UPDATE ${table} SET (${nameValuePairs.join(',')}) WHERE id = @id`;

  const input: DBTableFieldSpec[] = [{
    name: 'id',
    type: mssql.Int,
    value: id,
  }]
  const queryResult = runQuery(table, query, input);

  return Boolean(queryResult);
};

const deleteRecord = async (table: string, id: number): Promise<boolean> => {
  log('info', NAMESPACE, `Deleting record ${id} from ${table}`);

  const query = `DELETE FROM ${table} WHERE id = @id`;

  const input: DBTableFieldSpec[] = [{
    name: 'id',
    type: mssql.Int,
    value: id,
  }]
  const queryResult = runQuery(table, query, input);

  return Boolean(queryResult);
};

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
