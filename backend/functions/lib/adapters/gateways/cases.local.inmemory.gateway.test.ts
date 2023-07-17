const context = require('azure-function-context-mock');
import { CaseListDbResult } from '../types/cases';
import { getProperty } from '../../testing/mock-data/index';
import * as dataUtils from './local.inmemory.gateway';
import { Chapter11LocalGateway } from './cases.local.inmemory.gateway';

const table = 'cases';

const runQueryMock = jest.spyOn(dataUtils, 'runQuery');

jest.mock('../../configs/application-configuration', () => {
  // Require the original module!
  const originalModule = jest.requireActual('../../configs/application-configuration');
  const originalConfigClass = originalModule.ApplicationConfiguration;

  class MockAppConfig extends originalConfigClass {
    get(key: string) {
      // override result conditionally on input arguments
      if (key === 'dbMock') return true;
      // otherwise return using original behavior
      return super.get(key);
    }
  }

  return {
    ...originalModule,
    ApplicationConfiguration: MockAppConfig,
  };
});

describe('Local in-memory database gateway tests specific for cases', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  });

  afterEach(() => {
    list = null;
  });

  test('Should return a maximum of 20 results when fetching all records from Cases table', async () => {
    const mockResults: CaseListDbResult = {
      success: true,
      message: `${table} list`,
      count: 20,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: [...list.caseList].splice(0, 20),
      },
    };

    const db = new Chapter11LocalGateway();
    const results = await db.getCaseList(context, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });

  test('Should return 5 results when fetching all chapter 11 records on Cases table', async () => {
    const filteredList = list.caseList.filter((rec) => rec.currentCaseChapter === '11');

    const mockResults: CaseListDbResult = {
      success: true,
      message: `${table} list`,
      count: 5,
      body: {
        staff1Label: '',
        staff2Label: '',
        caseList: filteredList,
      },
    };

    const db = new Chapter11LocalGateway();
    const results = await db.getCaseList(context, { chapter: '11', professionalId: '' });

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

    const mockResults: CaseListDbResult = {
      success: false,
      message: `Test Query was invalid`,
      count: 0,
      body: {
        caseList: [],
      },
    };

    const db = new Chapter11LocalGateway();
    const results = await db.getCaseList(context, { chapter: '', professionalId: '' });

    expect(results).toEqual(mockResults);
  });
});
