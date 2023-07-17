import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data';
import * as dataUtils from './local.inmemory.gateway';
import * as db from './cases.local.inmemory.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');
import { ObjectKeyValArrayKeyVal } from '../types/basic';

const table = 'cases';
const appContext = applicationContextCreator(context);

const runQueryMock = jest.spyOn(dataUtils, 'runQuery');

describe('Local in-memory database gateway tests specific for cases', () => {
  let list: ObjectKeyValArrayKeyVal;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  });

  afterEach(() => {
    list = null;
  });

  test('Should return a maximum of 20 results when fetching all records from Cases table', async () => {
    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: 20,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: [...list.caseList].splice(0, 20),
      },
    };

    const results = await db.getCaseList(appContext, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 5 results when fetching all chapter 11 records on Cases table', async () => {
    const filteredList = list.caseList.filter((rec) => rec.currentCaseChapter === '11');

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

    const results = await db.getCaseList(appContext, { chapter: '11', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 0 results and an error message when fetching all records on Cases table with an invalid result from database', async () => {
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

    const results = await db.getCaseList(appContext, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });
});
