import log from '../services/logger.service';
import { userMockData, getProperty } from '../../testing/mock-data';
import { ApplicationContext } from '../types/basic';
import { UserListRecordSet } from '../types/users';
import { DbResult, QueryResults } from '../types/database';
import { runQuery } from './local.inmemory.gateway';

const NAMESPACE = 'USERS-LOCAL-INMEMORY-DB-GATEWAY';

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

const login = async (
  context: ApplicationContext,
  userName: { firstName: string; lastName: string },
): Promise<DbResult> => {
  let userListRecords: UserListRecordSet;

  log.info(context, NAMESPACE, `Get all from ${table}`);

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
