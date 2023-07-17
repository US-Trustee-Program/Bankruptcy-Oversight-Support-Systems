import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data';
import * as dataUtils from '../utils/database';
import * as db from './users.azure.sql.gateway';
import * as mssql from 'mssql';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');

const table = 'users';
const appContext = applicationContextCreator(context);

const runQueryMock = jest.spyOn(dataUtils, 'executeQuery');

describe('Azure MSSQL database gateway tests specifically for the Users table', () => {
  test('Should return a user record when users First Name and Last Name are provided', async () => {
    const list = await getProperty(table, 'list');

    const mockDbResult = {
      rowsAffected: [1],
      recordset: list.userList[0],
      output: {},
    };

    // create a jest spy to mock the query method of ConnectionPool
    const querySpy = jest.spyOn(mssql.ConnectionPool.prototype, 'query');

    // set the mock result for the query method
    querySpy.mockImplementation(() => Promise.resolve(mockDbResult as mssql.IResult<unknown>));

    runQueryMock.mockImplementation(() =>
      Promise.resolve({
        success: true,
        results: mockDbResult,
        message: 'Test Query',
      }),
    );

    const mockResults: DbResult = {
      success: true,
      message: 'user record',
      count: 1,
      body: list.userList[0],
    };

    const results = await db.login(appContext, { firstName: 'Test', lastName: 'Person' });

    expect(results).toEqual(mockResults);
  });

  test('Should return an error message and an unsuccessful result (failed query) when an invalid first name and last name are provided', async () => {
    runQueryMock.mockImplementation(() =>
      Promise.resolve({
        success: false,
        results: {},
        message: 'Test Query was invalid',
      }),
    );

    const mockResults: DbResult = {
      success: false,
      message: 'Test Query was invalid',
      count: 0,
      body: {},
    };

    const results = await db.login(appContext, { firstName: 'foo', lastName: 'bar' });

    expect(results).toEqual(mockResults);
  });
});
