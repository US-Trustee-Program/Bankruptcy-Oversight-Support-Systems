import log from '../services/logger.service';
import { userMockData, getProperty } from '../../testing/mock-data/';
import { LogContext } from '../types/basic';
import { UserListRecordSet, UserListDbResult } from '../types/users';
import { DbResult, QueryResults } from '../types/database';
import { validateTableName, runQuery } from './local.inmemory.gateway';

const NAMESPACE = 'USERS-MSSQL-DB-GATEWAY';

const table = 'users';

async function initializeUsers(): Promise<UserListRecordSet> {
  let userListRecords: UserListRecordSet;

  if (userMockData.users.initialized) {
    return userMockData[table];
  } else {
    userListRecords = await getProperty(table, 'list');
    userListRecords.initialized = true;
    userMockData[table] = userListRecords;
  }

  return userListRecords;
}

const login = async (context: LogContext, userName: { firstName: string, lastName: string }): Promise<DbResult> => {
  let userListRecords: UserListRecordSet;

  log.info(context, NAMESPACE, `Get all from ${table}`);

  if (!validateTableName) {
    throw new Error('Invalid database table name');
  }

  userListRecords = await initializeUsers();

  let input = [
    {
      name: 'firstName',
      value: userName.firstName,
    },
    {
      name: 'lastName',
      value: userName.lastName,
    },
  ];

  const queryResult: QueryResults = await runQuery(context, '', userListRecords.userList, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(context, NAMESPACE, 'User login DB query successful');
    const body = queryResult.results;
    const rowsAffected = (queryResult.results as Array<{}>).length;
    results = {
      success: true,
      message: `user record`,
      count: rowsAffected,
      body: body as Object,
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
