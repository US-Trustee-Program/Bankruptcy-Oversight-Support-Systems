import { applicationContextCreator } from '../utils/application-context-creator';
import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data';
import * as dataUtils from '../utils/database';
import * as db from './azure.sql.gateway';
import * as mssql from 'mssql';
const context = require('azure-function-context-mock');

const table = 'generic-test-data';
const appContext = applicationContextCreator(context);

const runQueryMock = jest.spyOn(dataUtils, 'executeQuery');

describe('Azure MSSQL database gateway tests', () => {
  test('Should return all records when fetching all records on a given table', async () => {
    const list = await getProperty(table, 'list');

    const mockDbResult = {
      rowsAffected: [10],
      recordset: list,
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
      message: `${table} list`,
      count: list.length,
      body: list,
    };

    const results = await db.getAll(appContext, appContext.config.acmsDbConfig.database, table);

    expect(results).toEqual(mockResults);
  });

  test('Should return 1 records details when fetching 1 record on a given table', async () => {
    const list = await getProperty(table, 'list');

    const mockDbResult = {
      rowsAffected: [1],
      recordset: list[5],
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
      message: '',
      count: 1,
      body: list[5],
    };

    const results = await db.getRecord(
      appContext,
      appContext.config.acmsDbConfig.database,
      table,
      6,
    );

    expect(results).toEqual(mockResults);
  });

  test('Should return 0 results when fetching all records with an invalid query', async () => {
    runQueryMock.mockImplementation(() =>
      Promise.resolve({
        success: false,
        results: {},
        message: 'Test Query was invalid',
      }),
    );

    const mockResults: DbResult = {
      success: false,
      message: `Test Query was invalid`,
      count: 0,
      body: {},
    };

    const results = await db.getAll(appContext, appContext.config.acmsDbConfig.database, table);

    expect(results).toEqual(mockResults);
  });

  test('Should return 0 results when fetching 1 record with an invalid query', async () => {
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

    const results = await db.getRecord(
      appContext,
      appContext.config.acmsDbConfig.database,
      table,
      6,
    );

    expect(results).toEqual(mockResults);
  });
});
