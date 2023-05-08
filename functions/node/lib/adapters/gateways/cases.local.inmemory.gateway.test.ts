const context = require('azure-function-context-mock');
import { DbResult } from '../types/database.js';
import { getProperty } from '../../testing/mock-data/';
import * as dataUtils from './local.inmemory.gateway';
import * as db from './cases.local.inmemory.gateway';

const table = 'cases';

const runQueryMock = jest.spyOn(dataUtils, 'runQuery');

describe('Local in-memory database gateway tests specific for cases', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  })

  afterEach(() => {
    list = null;
  })

  test('Fetching all records on a given table returns 10 results', async () => {
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

    const results = await db.getCaseList(context, {chapter: '', professionalId: ''});

    expect(results).toEqual(mockResults);
  });

  test('Fetching all chapter 11 records on a given table returns 5 results', async () => {
    const filteredList = list.caseList.filter((rec) => (rec.currentCaseChapter === '11'));

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

  /*
  test('Fetching specific case record returns 1 expected result', async () => {
    const caseList = list.caseList.filter(rec => (rec.caseDiv === '407'));

    const mockResults: DbResult = {
      success: true,
      message: `${table} record`,
      count: 1,
      body: list
    };

    const results = await db.getCase(context, '407');

    expect(results).toEqual(mockResults);
  });
  */
});
