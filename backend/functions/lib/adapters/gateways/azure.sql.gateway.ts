import * as mssql from 'mssql';
import { DbResult, QueryResults, DbTableFieldSpec } from '../types/database';
import { executeQuery } from '../utils/database';
import { Context } from '../types/basic';

const NAMESPACE = 'AZURE-SQL-MODULE';

const getAll = async (context: Context, table: string): Promise<DbResult> => {
  const query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = await executeQuery(context, query);
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

const getRecord = async (context: Context, table: string, id: number): Promise<DbResult> => {
  let query = `SELECT * FROM ${table} WHERE ${table}_id = @id`;
  let results: DbResult;
  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await executeQuery(context, query, input);

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

export { getAll, getRecord };
