import { Chapter11ApiGateway } from './cases.azure.sql.gateway';
import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data';
import * as dataUtils from '../utils/database';
import * as mssql from 'mssql';
import { applicationContextCreator } from '../utils/application-context-creator';
import { ObjectKeyValArrayKeyVal } from '../types/basic';
const context = require('azure-function-context-mock');

const table = 'cases';
const appContext = applicationContextCreator(context);

const runQueryMock = jest.spyOn(dataUtils, 'executeQuery');

describe('Azure MSSQL database gateway tests specifically for the Cases table', () => {
  let list: ObjectKeyValArrayKeyVal;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  });

  afterEach(() => {
    list = null;
  });

  test('Should return a maximum of 20 results when fetching all records from Cases table', async () => {
    const mockDbResult = {
      rowsAffected: [20],
      recordset: [...list.caseList].splice(0, 20),
      output: {},
    };

    const truncatedList = [...list.caseList].splice(0, 20);

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
      count: truncatedList.length,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: truncatedList,
      },
    };

    const db = new Chapter11ApiGateway();
    const results = await db.getCaseList(appContext, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 5 results when fetching all chapter 11 records on Cases table', async () => {
    const filteredList = list.caseList.filter((rec) => rec.currentCaseChapter === '11');

    const mockDbResult = {
      rowsAffected: [filteredList.length],
      recordset: filteredList,
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
      count: 5,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: filteredList,
      },
    };

    const db = new Chapter11ApiGateway();
    const results = await db.getCaseList(appContext, { chapter: '11', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 5 results when fetching all records with specific professional name on Cases table', async () => {
    const filteredList = list.caseList.filter(
      (rec) =>
        (rec.staff1ProfFirstName as string).includes('Donna') &&
        (rec.staff1ProfLastName as string).includes('Clayton'),
    );

    const mockDbResult = {
      rowsAffected: [filteredList.length],
      recordset: filteredList,
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
      count: 5,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: filteredList,
      },
    };

    const db = new Chapter11ApiGateway();
    const results = await db.getCaseList(appContext, { chapter: '', professionalId: 'A1' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 0 results and an error message when fetching all records on a given table with an invalid result from database', async () => {
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
      body: {
        caseList: [],
      },
    };

    const db = new Chapter11ApiGateway();
    const results = await db.getCaseList(appContext, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });
});
