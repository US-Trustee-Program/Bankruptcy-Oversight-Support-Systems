import * as mssql from 'mssql';
import { DbResult, DbTableFieldSpec, QueryResults } from '../types/database';
import { executeQuery } from '../utils/database';
import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';

const NAMESPACE = 'USERS-MSSQL-DB-GATEWAY';

const login = async (
  context: ApplicationContext,
  userName: { firstName: string; lastName: string },
): Promise<DbResult> => {
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

  const queryResult: QueryResults = await executeQuery(context, query, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(context, NAMESPACE, 'User login DB query successful');
    const records = (queryResult.results as mssql.IResult<any>).recordset;
    const rowsAffected = (queryResult.results as mssql.IResult<any>).rowsAffected[0];
    results = {
      success: true,
      message: `user record`,
      count: rowsAffected,
      body: records,
    };
  } else {
    log.warn(context, NAMESPACE, 'User login DB query unsuccessful');
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
