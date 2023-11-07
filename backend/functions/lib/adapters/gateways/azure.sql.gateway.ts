/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mssql from 'mssql';
import { DbResult, QueryResults, DbTableFieldSpec } from '../types/database';
import { executeQuery } from '../utils/database';
import { ApplicationContext } from '../types/basic';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MODULE_NAME = 'AZURE-SQL-MODULE';

const getAll = async (applicationContext: ApplicationContext, table: string): Promise<DbResult> => {
  const query = `SELECT * FROM ${table}`;
  const queryResult: QueryResults = await executeQuery(
    applicationContext,
    applicationContext.config.acmsDbConfig,
    query,
  );
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

const getRecord = async (
  applicationContext: ApplicationContext,
  table: string,
  id: number,
): Promise<DbResult> => {
  const query = `SELECT * FROM ${table} WHERE ${table}_id = @id`;
  let results: DbResult;
  const input: DbTableFieldSpec[] = [
    {
      name: 'id',
      type: mssql.Int,
      value: id,
    },
  ];
  const queryResult = await executeQuery(
    applicationContext,
    applicationContext.config.acmsDbConfig,
    query,
    input,
  );

  if (
    Boolean(queryResult) &&
    queryResult.success &&
    typeof (queryResult.results as mssql.IResult<any>).rowsAffected != 'undefined' &&
    (queryResult.results as mssql.IResult<any>).rowsAffected[0] === 1
  ) {
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
