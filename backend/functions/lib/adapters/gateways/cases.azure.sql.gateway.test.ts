const context = require('azure-function-context-mock');
import { getProperty } from '../../testing/mock-data/index';
import * as dataUtils from '../utils/database';
import * as db from './cases.azure.sql.gateway';
import * as mssql from 'mssql';

const table = 'cases';

const runQueryMock = jest.spyOn(dataUtils, 'executeQuery');

describe('Azure MSSQL database gateway tests specificaly for the Cases table', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  })

  afterEach(() => {
    list = null;
  })

  test('Should return a maximum of 20 results when fetching all records from Cases table', async () => {
    const mockDbResult = {
      rowsAffected: [20],
      recordset: [...list.caseList].splice(0, 20),
      output: {},
    }

    let truncatedList = [...list.caseList].splice(0, 20);

    // create a jest spy to mock the query method of ConnectionPool
    const querySpy = jest.spyOn(mssql.ConnectionPool.prototype, 'query');

    // set the mock result for the query method
    querySpy.mockReturnValue(Promise.resolve(mockDbResult) as any);

    runQueryMock.mockImplementation(() => Promise.resolve({
      success: true,
      results: mockDbResult,
      message: 'Test Query',
    }));

    const results = await db.getCaseList(context, { chapter: '', professionalId: '' });

    expect(results).toEqual(truncatedList);
  });

  test('Should return 5 results when fetching all chapter 11 records on Cases table', async () => {
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

    const results = await db.getCaseList(context, { chapter: '11', professionalId: '' });

    expect(results).toEqual(filteredList);
  });

  test('Should return 5 results when fetching all records with specific professional name on Cases table', async () => {
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

    const results = await db.getCaseList(context, { chapter: '', professionalId: 'A1' });

    expect(results).toEqual(filteredList);
  });

  test('Should return 0 results and an error message when fetching all records on a given table with an invalid result from database', async () => {
    runQueryMock.mockImplementation(() => Promise.resolve({
      success: false,
      results: {},
      message: 'Test Query was invalid',
    }));

    try {
      await db.getCaseList(context, { chapter: '', professionalId: '' });
    } catch (e) {
      expect(e.message).toEqual('Test Query was invalid')
    }
  });

});
