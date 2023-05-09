const context = require('azure-function-context-mock');
import { DbResult } from '../types/database.js';
import { getProperty } from '../../testing/mock-data/';
import * as dataUtils from '../utils/database';
import * as db from './cases.azure.sql.gateway';
import * as mssql from 'mssql';

const table = 'cases';

const runQueryMock = jest.spyOn(dataUtils, 'runQuery');

describe('Azure MSSQL database gateway tests specificaly for the Cases table', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  })

  afterEach(() => {
    list = null;
  })

  test('Fetching all records from Cases table returns 10 results', async () => {
    const mockDbResult = {
      rowsAffected: [10],
      recordset: list.caseList,
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
      count: list.caseList.length,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: list.caseList,
      }
    };

    const results = await db.getCaseList(context, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Fetching all chapter 11 records on Cases table returns 5 results', async () => {
    const filteredList = list.caseList.filter((rec) => (rec.currentCaseChapter === '11'));

    const mockDbResult = {
      rowsAffected: [filteredList.length],
      recordset: filteredList,
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
      count: 5,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: filteredList,
      }
    };

    const results = await db.getCaseList(context, {chapter: '11', professionalId: ''});

    expect(results).toEqual(mockResults);
  });

  test('Fetching all records with specific professional name on Cases table returns 5 results', async () => {
    const filteredList = list.caseList.filter((rec) => (
      rec.staff1ProfFirstName.includes('Donna') &&
      rec.staff1ProfLastName.includes('Clayton')
    ));

    const mockDbResult = {
      rowsAffected: [filteredList.length],
      recordset: filteredList,
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
      count: 5,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: filteredList,
      }
    };

    const results = await db.getCaseList(context, {chapter: '', professionalId: 'A1'});

    expect(results).toEqual(mockResults);
  });

  test('Fetching all records on a given table with an invalid result from database returns 0 results and a message', async () => {
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

    const results = await db.getCaseList(context, {chapter: '', professionalId: ''});

    expect(results).toEqual(mockResults);
  });

});
