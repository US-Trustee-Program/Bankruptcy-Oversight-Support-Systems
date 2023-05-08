const context = require('azure-function-context-mock');
import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data/';
import * as dataUtils from '../utils/database';
import * as db from './azure.sql.gateway';
import * as mssql from 'mssql';

const table = 'generic_test_data';

const runQueryMock = jest.spyOn(dataUtils, 'runQuery');

describe('Azure MSSQL database gateway tests', () => {
  test('Fetching all records on a given table returns the expected results', async () => {
    const list = await getProperty(table, 'list');

    const mockDbResult = {
      rowsAffected: [10],
      recordset: list,
      output: {},
    }

    // create a jest spy to mock the query method of ConnectionPool
    const querySpy = jest.spyOn(mssql.ConnectionPool.prototype, 'query');

    // set the mock result for the query method
    querySpy.mockReturnValue(Promise.resolve(mockDbResult) as any);

    runQueryMock.mockImplementation(() => Promise.resolve({
      success: true,
      results: mockDbResult,
      message: 'Test Query',
    }));

    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length,
      body: list,
    };

    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });

  test('Fetching 1 record on a given table returns the expected results', async () => {
    const list = await getProperty(table, 'list');

    const mockDbResult = {
      rowsAffected: [1],
      recordset: list[5],
      output: {},
    }

    // create a jest spy to mock the query method of ConnectionPool
    const querySpy = jest.spyOn(mssql.ConnectionPool.prototype, 'query');

    // set the mock result for the query method
    querySpy.mockReturnValue(Promise.resolve(mockDbResult) as any);

    runQueryMock.mockImplementation(() => Promise.resolve({
      success: true,
      results: mockDbResult,
      message: 'Test Query',
    }));

    const mockResults: DbResult = {
      success: true,
      message: '',
      count: 1,
      body: list[5],
    };

    const results = await db.getRecord(context, table, 6);

    expect(results).toEqual(mockResults);
  });

  test('Fetching all records with an invalid query returns 0 results and a message', async () => {
    runQueryMock.mockImplementation(() => Promise.resolve({
      success: false,
      results: {},
      message: 'Test Query was invalid',
    }));

    const mockResults: DbResult = {
      success: false,
      message: `Test Query was invalid`,
      count: 0,
      body: {},
    };

    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });

  test('Fetching 1 record with an invalid query returns 0 results and a message', async () => {
    runQueryMock.mockImplementation(() => Promise.resolve({
      success: false,
      results: {},
      message: 'Test Query was invalid',
    }));

    const mockResults: DbResult = {
      success: false,
      message: 'Test Query was invalid',
      count: 0,
      body: {},
    };

    const results = await db.getRecord(context, table, 6);

    expect(results).toEqual(mockResults);
  });
});
