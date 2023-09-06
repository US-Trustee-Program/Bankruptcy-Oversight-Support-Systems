import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';
import * as database from '../utils/database';
import { QueryResults } from '../types/database';
import * as mssql from 'mssql';
import { getCamsDateStringFromDate } from '../utils/date-helper';

const context = require('azure-function-context-mock');
const appContext = applicationContextCreator(context);

const querySpy = jest.spyOn(database, 'executeQuery');

describe('Test DXTR Gateway', () => {
  test('should call executeQuery with the default starting month and return expected results', async () => {
    const cases = [
      {
        caseNumber: 'case-one',
        caseTitle: 'Debtor One',
        dateFiled: '2018-11-16T00:00:00.000Z',
      },
      {
        caseNumber: 'case-two',
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
      {
        caseNumber: 'case-three',
        caseTitle: 'Debtor Three',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
    ];
    const mockResults: QueryResults = {
      success: true,
      results: cases,
      message: '',
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getChapter15Cases(appContext, {});
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    const dateFiledFrom = getCamsDateStringFromDate(date);
    const expectedDateInput = {
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    };
    expect(querySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
    expect(actualResult).not.toEqual(cases);
  });

  test('should call executeQuery with the right date when a startingMonth option is passed', async () => {
    const cases = [
      {
        caseNumber: 'case-one',
        caseTitle: 'Debtor One',
        dateFiled: '2018-11-16T00:00:00.000Z',
      },
    ];
    const mockResults: QueryResults = {
      success: true,
      results: cases,
      message: '',
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const startingMonth = -12;
    await testCasesDxtrGateway.getChapter15Cases(appContext, {
      startingMonth,
    });
    const date = new Date();
    date.setMonth(date.getMonth() + startingMonth);
    const dateFiledFrom = getCamsDateStringFromDate(date);
    const expectedDateInput = {
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    };

    expect(querySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
  });

  test('should throw error when executeQuery returns success=false', async () => {
    const errorMessage = 'There was some fake error.';
    const mockResults: QueryResults = {
      success: false,
      results: {},
      message: errorMessage,
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

    try {
      await testCasesDxtrGateway.getChapter15Cases(appContext, {});
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual(errorMessage);
    }
  });
});
