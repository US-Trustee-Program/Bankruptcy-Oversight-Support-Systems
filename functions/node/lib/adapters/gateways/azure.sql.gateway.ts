import * as mssql from 'mssql';
import log from '../services/logger.service.js';
import { RecordObj, ObjectKeyVal } from '../types/basic.js';
import { DbResult, QueryResults, DbTableFieldSpec } from '../types/database.js';
import { runQuery } from '../utils/database.js';
import { LogContext } from '../types/basic.js';

const NAMESPACE = 'AZURE-SQL-MODULE';

const getAll = async (context: LogContext, table: string): Promise<DbResult> => {
  const query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = await runQuery(context, table, query);
  let results: DbResult;

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

const getRecord = async (context: LogContext, table: string, id: number): Promise<DbResult> => {
  let query = `SELECT * FROM ${table} WHERE ${table}_id = @id`;
  let results: DbResult;
  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await runQuery(context, table, query, input);

  if (Boolean(queryResult) && queryResult.success && typeof (queryResult as any).results.rowsAffected != 'undefined' && (queryResult as any).results.rowsAffected[0] === 1) {
    results = {
      message: '',
      count: 1,
      body: (queryResult.results as mssql.IResult<any>).recordset,
      success: true,
    };
  } else {
    results = {
      message: queryResult.message,
      count: 0,
      body: {},
      success: false,
    };
  }

  return results;
};

const createRecord = async (context: LogContext, table: string, fieldArr: RecordObj[]): Promise<DbResult> => {
  let fieldNameArr: string[] = [];
  let fieldValueArr: string[] = [];

  fieldArr.forEach((fields: ObjectKeyVal) => {
    fieldNameArr.push(`${fields['fieldName']}`);
    fieldValueArr.push("'" + fields['fieldValue'] + "'");
  });

  const presentation: object = generatePresentationRecord(context, table, 0, fieldArr);

  const query = `INSERT INTO ${table} (${fieldNameArr.join(',')}) VALUES (${fieldValueArr.join(',')})`;

  const queryResult = await runQuery(context, table, query);

  if (Boolean(queryResult) && typeof (queryResult as any).results.rowsAffected != 'undefined' && (queryResult as any).results.rowsAffected[0] === 1) {
    return {
      success: true,
      count: 1,
      message: '',
      body: presentation,
    };
  } else {
    return {
      success: false,
      count: 0,
      message: `${table} could not be updated with the given data.`,
      body: presentation,
    };
  }
};

const updateRecord = async (context: LogContext, table: string, id: number, fieldArr: RecordObj[]): Promise<DbResult> => {
  let nameValuePairs: string[] = [];

  fieldArr.forEach((fields: ObjectKeyVal) => {
    nameValuePairs.push(fields['fieldName'] + "='" + fields['fieldValue'] + "'");
  });

  const query = `UPDATE ${table} SET ${nameValuePairs.join(',')} WHERE ${table}_id = @id`;

  const presentation: object = generatePresentationRecord(context, table, id, fieldArr);

  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await runQuery(context, table, query, input);

  if (Boolean(queryResult) && typeof (queryResult as any).results.rowsAffected != 'undefined' && (queryResult as any).results.rowsAffected[0] === 1) {
    return {
      success: true,
      count: 1,
      message: '',
      body: presentation,
    };
  } else {
    return {
      success: false,
      count: 0,
      message: `${table} could not be updated with the given data.`,
      body: presentation,
    };
  }
};

const deleteRecord = async (context: LogContext, table: string, id: number): Promise<DbResult> => {
  log.info(context, NAMESPACE, `Deleting record ${id} from ${table}`);

  const query = `DELETE FROM ${table} WHERE ${table}_id = @id`;

  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await runQuery(context, table, query, input);

  if (Boolean(queryResult) && typeof (queryResult as any).results.rowsAffected != 'undefined' && (queryResult as any).results.rowsAffected[0] === 1) {
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
};

function generatePresentationRecord(context: LogContext, table: string, id: string | number, fieldArr: RecordObj[]): object {
  let resultObj: ObjectKeyVal = {
    [`${table}_id`]: id,
  };

  fieldArr.forEach((fields: ObjectKeyVal) => {
    resultObj[fields['fieldName']] = fields['fieldValue'];
  });

  return resultObj;
}

export { createRecord, getAll, getRecord, updateRecord, deleteRecord };
