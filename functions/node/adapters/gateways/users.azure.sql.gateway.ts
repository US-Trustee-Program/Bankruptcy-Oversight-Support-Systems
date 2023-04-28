import * as mssql from 'mssql';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database.js';
import { runQuery } from '../utils/database.js';
import log from '../services/logger.service.js';

const NAMESPACE = 'USERS-MSSQL-DB-GATEWAY';

const login = async (userName: { firstName: string, lastName: string }): Promise<DbResult> => {
  let input: DbTableFieldSpec[] = [];

  let query = `SELECT
      PROF_FIRST_NAME AS firstName,
      PROF_MI AS middleInitial,
      PROF_LAST_NAME AS lastName,
      UST_PROF_CODE AS professionalId
    FROM CMMPR
    WHERE
      DELETE_CODE <> 'D'
      AND PROF_FIRST_NAME = @firstName AND PROF_LAST_NAME = @lastName
  `;

  input = [
    {
      name: 'firstName',
      type: mssql.Char,
      value: userName.firstName,
    },
    {
      name: 'lastName',
      type: mssql.Char,
      value: userName.lastName,
    },
  ];

  const queryResult: QueryResults = await runQuery('CMMPR', query, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(NAMESPACE, 'User login DB query successful');
    const records = (queryResult.results as mssql.IResult<any>).recordset;
    const rowsAffected = (queryResult.results as mssql.IResult<any>).rowsAffected[0];
    results = {
      success: true,
      message: `user record`,
      count: rowsAffected,
      body: records,
    };
  } else {
    log.warn(NAMESPACE, 'User login DB query unsuccessful');
    results = {
      success: false,
      message: queryResult.message,
      count: 0,
      body: {},
    };
  }

  return results;
};

export { login };
