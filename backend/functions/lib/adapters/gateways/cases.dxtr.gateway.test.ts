import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';
import * as database from '../utils/database';
import { QueryResults } from '../types/database';
import * as mssql from 'mssql';
import { getYearMonthDayStringFromDate } from '../utils/date-helper';
import { CaseDetailInterface } from '../types/cases';
import * as featureFlags from '../utils/feature-flag';

const context = require('azure-function-context-mock');
const dxtrDatabaseName = 'some-database-name';

describe('Test DXTR Gateway', () => {
  let appContext;
  const querySpy = jest.spyOn(database, 'executeQuery');
  beforeEach(async () => {
    const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
    featureFlagSpy.mockImplementation(async () => {
      return {};
    });
    appContext = await applicationContextCreator(context);
    appContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    querySpy.mockImplementation(jest.fn());
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should call executeQuery with the default starting month and return expected results', async () => {
    const cases = [
      {
        caseId: 'case-one',
        caseTitle: 'Debtor One',
        dateFiled: '2018-11-16T00:00:00.000Z',
      },
      {
        caseId: 'case-two',
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
      {
        caseId: 'case-three',
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
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    const expectedDateInput = {
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    };
    expect(querySpy).toHaveBeenCalledWith(
      expect.anything(),
      appContext.config.dxtrDbConfig,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
    expect(actualResult).not.toEqual(cases);
  });
  test('should call getAllCases and return expected results', async () => {
    const cases = [
      {
        caseId: 'case-one',
        caseTitle: 'Debtor One',
        dateFiled: '2018-11-16T00:00:00.000Z',
      },
      {
        caseId: 'case-two',
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
      {
        caseId: 'case-three',
        caseTitle: 'Debtor Three',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
      {
        caseId: 'case-four',
        caseTitle: 'Debtor Four',
        dateFiled: '2018-10-16T00:00:00.000Z',
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
    const actualResult = await testCasesDxtrGateway.getAllCases(appContext, {});
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    const expectedDateInput = {
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    };
    expect(querySpy).toHaveBeenCalledWith(
      expect.anything(),
      appContext.config.dxtrDbConfig,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
    expect(actualResult).not.toEqual(cases);
    console.log(actualResult);
  });

  test('should call executeQuery with the right date when a startingMonth option is passed', async () => {
    const cases = [
      {
        caseId: 'case-one',
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
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    const expectedDateInput = {
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    };

    expect(querySpy).toHaveBeenCalledWith(
      expect.anything(),
      appContext.config.dxtrDbConfig,
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

  test('should return a single chapter 15 case when supplied a caseId', async () => {
    const caseId = 'case-one';
    const cases = [
      {
        caseId: caseId,
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
        dxtrId: '123',
        courtId: '567',
        chapter: '15',
      },
    ];
    const mockCaseResults: QueryResults = {
      success: true,
      results: {
        recordset: cases,
      },
      message: '',
    };

    const transactions = [
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz230830zzzzzzzzzzzz',
        txCode: 'CBC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz',
        txCode: 'CBC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz',
        txCode: 'CDC',
      },
    ];

    const mockTransactionResults: QueryResults = {
      success: true,
      results: {
        recordset: transactions,
      },
      message: '',
    };

    querySpy.mockImplementationOnce(async () => {
      console.log('Inside MockImplementation Once: ', mockCaseResults);
      return Promise.resolve(mockCaseResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getChapter15Case(appContext, caseId);

    const closedDate = '10-31-2023';
    const expected: CaseDetailInterface = {
      ...cases[0],
      closedDate,
    };
    expect(actualResult).toStrictEqual(expected);
    expect(actualResult.closedDate).toEqual(closedDate);
  });

  test('should call executeQuery with the expected properties for a case', async () => {
    const query = `select
        CS_DIV+'-'+CASE_ID as caseId,
        CS_SHORT_TITLE as caseTitle,
        FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled,
        CS_CASEID as dxtrId,
        CS_CHAPTER as chapter,
        COURT_ID as courtId
        FROM [dbo].[AO_CS]
        WHERE CASE_ID = @dxtrCaseId
        AND CS_DIV = @courtDiv`;

    const caseId = 'case-one';
    const cases = [
      {
        caseId: caseId,
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
        dxtrId: '123',
        courtId: '567',
        chapter: '15',
      },
    ];

    const mockCaseResults: QueryResults = {
      success: true,
      results: {
        recordset: cases,
      },
      message: '',
    };

    const transactions = [
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz230830zzzzzzzzzzzz',
        txCode: 'CBC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz',
        txCode: 'CBC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz',
        txCode: 'CDC',
      },
    ];

    const mockTransactionResults: QueryResults = {
      success: true,
      results: {
        recordset: transactions,
      },
      message: '',
    };

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockCaseResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    await testCasesDxtrGateway.getChapter15Case(appContext, '23-12345');
    expect(querySpy.mock.calls[0][2]).toBe(query);
  });
  describe('Feature flag chapter-twelve-enabled', () => {
    test('should return a chapter column in the result set when true.', async () => {
      const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
      featureFlagSpy.mockImplementation(async () => {
        return { 'chapter-twelve-enabled': true };
      });
      appContext = await applicationContextCreator(context);

      const cases = [
        {
          caseId: 'case-one',
          chapter: '15',
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
      await testCasesDxtrGateway.getAllCases(appContext, {});
      expect(querySpy.mock.calls[0][2]).toContain('UNION ALL');
      expect(querySpy.mock.calls[0][2]).toContain("CS_CHAPTER = '12'");
    });
    test('should not return a chapter column in the result set when false.', async () => {
      const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
      featureFlagSpy.mockImplementation(async () => {
        return { 'chapter-twelve-enabled': false };
      });
      appContext = await applicationContextCreator(context);

      const cases = [
        {
          caseId: 'case-one',
          chapter: '15',
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
      await testCasesDxtrGateway.getChapter15Cases(appContext, {});
      expect(querySpy.mock.calls[0][2]).not.toContain('UNION ALL');
      expect(querySpy.mock.calls[0][2]).not.toContain("CS_CHAPTER = '12'");
    });
  });
});
