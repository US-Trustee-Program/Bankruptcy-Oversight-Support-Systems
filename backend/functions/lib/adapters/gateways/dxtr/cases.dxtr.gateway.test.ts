import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../../utils/application-context-creator';
import * as database from '../../utils/database';
import { QueryResults } from '../../types/database';
import * as mssql from 'mssql';
import { getYearMonthDayStringFromDate } from '../../utils/date-helper';
import { CaseDetail } from '../../../../../../common/src/cams/cases';
import * as featureFlags from '../../utils/feature-flag';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CASE_SUMMARIES } from '../../../testing/mock-data/case-summaries.mock';
import { DEBTORS } from '../../../testing/mock-data/debtors.mock';
import { MockData } from '../../../../../../common/src/cams/test-utilities/mock-data';

const context = require('azure-function-context-mock');
const dxtrDatabaseName = 'some-database-name';

describe('Test DXTR Gateway', () => {
  let applicationContext;
  let testCasesDxtrGateway;
  const querySpy = jest.spyOn(database, 'executeQuery');

  beforeEach(async () => {
    const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
    featureFlagSpy.mockImplementation(async () => {
      return {};
    });
    applicationContext = await applicationContextCreator(context);
    applicationContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    testCasesDxtrGateway = new CasesDxtrGateway();

    querySpy.mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should call executeQuery with the default starting month and return expected results', async () => {
    const mockResults: QueryResults = {
      success: true,
      results: {
        recordset: [],
      },
      message: '',
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    await testCasesDxtrGateway.getCases(applicationContext, {});
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
      applicationContext.config.dxtrDbConfig,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
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
      results: {
        recordset: cases,
      },
      message: '',
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    const startingMonth = -12;
    await testCasesDxtrGateway.getCases(applicationContext, {
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
      applicationContext.config.dxtrDbConfig,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining(expectedDateInput)]),
    );
  });

  // TODO: Find a way to cover the different scenarios where executeQuery throws an error
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

    try {
      await testCasesDxtrGateway.getCases(applicationContext, {});
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as CamsError).message).toEqual(errorMessage);
    }
  });

  test('should return a single case when supplied a caseId', async () => {
    const closedDate = '2023-10-31';
    const dismissedDate = '2023-11-15';
    const reopenedDate = '2023-12-31';

    const expectedParty = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };

    const expectedDebtorAttorney = {
      name: 'James Brown Esq.',
      address1: '456 South St',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
      email: undefined,
      office: undefined,
    };

    const expectedDebtorTypeLabel = 'Corporate Business';

    const testCase = MockData.getCaseDetail({
      entityType: 'company',
      override: {
        debtor: expectedParty,
        debtorAttorney: expectedDebtorAttorney,
        debtorTypeCode: 'CB',
        debtorTypeLabel: expectedDebtorTypeLabel,
        regionId: '04',
      },
    });

    const cases = [testCase];

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
        txRecord: 'zzzzzzzzzzzzzzzzzzz231115zzzzzzzzzzzz',
        txCode: 'CDC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231231zzzzzzzzzzzz',
        txCode: 'OCO',
      },
    ];

    const mockCaseResults: QueryResults = {
      success: true,
      results: {
        recordset: cases,
      },
      message: '',
    };

    const mockTransactionResults: QueryResults = {
      success: true,
      results: {
        recordset: transactions,
      },
      message: '',
    };

    const mockQueryParties: QueryResults = {
      success: true,
      results: {
        recordset: [expectedParty],
      },
      message: '',
    };

    const mockQueryDebtorAttorney: QueryResults = {
      success: true,
      results: {
        recordset: [expectedDebtorAttorney],
      },
      message: '',
    };

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockCaseResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryParties);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryDebtorAttorney);
    });

    const actualResult = await testCasesDxtrGateway.getCaseDetail(
      applicationContext,
      testCase.caseId,
    );

    const expectedResult: CaseDetail = {
      ...testCase,
      closedDate,
      dismissedDate,
      reopenedDate,
    };

    expect(actualResult).toStrictEqual(expectedResult);
    expect(actualResult.regionId).toEqual(testCase.regionId);
    expect(actualResult.courtDivisionCode).toEqual(testCase.courtDivisionCode);
    expect(actualResult.courtName).toEqual(testCase.courtName);
    expect(actualResult.courtDivisionName).toEqual(testCase.courtDivisionName);
    expect(actualResult.closedDate).toEqual(closedDate);
    expect(actualResult.dismissedDate).toEqual(dismissedDate);
    expect(actualResult.reopenedDate).toEqual(reopenedDate);
    expect(actualResult.debtor).toEqual(expectedParty);
    expect(actualResult.debtorAttorney).toEqual(expectedDebtorAttorney);
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
  });

  test('should return a single case summary when supplied a caseId', async () => {
    const expectedDebtorTypeLabel = 'Corporate Business';
    const testCase = MockData.getCaseDetail({
      entityType: 'company',
      override: {
        debtorTypeCode: 'CB',
        debtorTypeLabel: expectedDebtorTypeLabel,
        petitionCode: 'VP',
        petitionLabel: 'Voluntary',
      },
    });

    const cases = [testCase];
    const mockCaseResults: QueryResults = {
      success: true,
      results: {
        recordset: cases,
      },
      message: '',
    };

    const mockQueryParties: QueryResults = {
      success: true,
      results: {
        recordset: [{ partyName: 'John Q. Smith' }],
      },
      message: '',
    };

    const mockDebtorTypeTransactionResults = {
      success: true,
      results: {
        recordset: [
          {
            txRecord:
              '1081201013220-10132            15CB               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
            txCode: '1',
          },
        ],
      },
      message: '',
    };

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockCaseResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryParties);
    });

    // First for the debtor type.
    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockDebtorTypeTransactionResults);
    });

    // Second time for the petition type.
    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockDebtorTypeTransactionResults);
    });

    const actualResult = await testCasesDxtrGateway.getCaseSummary(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.regionId).toEqual(testCase.regionId);
    expect(actualResult.courtName).toEqual(testCase.courtName);
    expect(actualResult.courtDivisionCode).toEqual(testCase.courtDivisionCode);
    expect(actualResult.courtDivisionName).toEqual(testCase.courtDivisionName);
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
  });

  test('should throw an error if a case summary is not found', async () => {
    const expectedError = new NotFoundError('CASES-DXTR-GATEWAY', {
      message: 'Case summary not found for case ID.',
    });
    querySpy.mockResolvedValue({
      results: {
        recordsets: [[]],
        recordset: [],
        output: {},
        rowsAffected: [0],
      },
      message: '',
      success: true,
    });
    await expect(
      testCasesDxtrGateway.getCaseSummary(applicationContext, '000-00-00000'),
    ).rejects.toThrow(expectedError);
  });

  test('should call executeQuery with the expected properties for a case', async () => {
    const testCase = MockData.getCaseDetail();
    const cases = [testCase];

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

    const mockQueryParties: QueryResults = {
      success: true,
      results: {
        recordset: [{ partyName: 'John Q. Smith' }],
      },
      message: '',
    };

    const expectedDebtorAttorney = {
      name: 'James Brown Esq.',
      address1: '456 South St',
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
    };

    const mockQueryDebtorAttorney: QueryResults = {
      success: true,
      results: {
        recordset: [expectedDebtorAttorney],
      },
      message: '',
    };

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockCaseResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryParties);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryDebtorAttorney);
    });

    await testCasesDxtrGateway.getCaseDetail(applicationContext, '081-23-12345');
    // getCase
    expect(querySpy.mock.calls[0][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrCaseId', value: '23-12345' }),
        expect.objectContaining({ name: 'courtDiv', value: '081' }),
      ]),
    );
    // getTransactions
    expect(querySpy.mock.calls[1][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtors
    expect(querySpy.mock.calls[2][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtorAttorneys
    expect(querySpy.mock.calls[3][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
  });

  describe.each([
    ['chapter-eleven-enabled', '11'],
    ['chapter-twelve-enabled', '12'],
  ])('Feature flag - chapter enabled', (featureFlagKey, chapterNumber) => {
    test('should return a chapter column in the result set when true.', async () => {
      const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
      featureFlagSpy.mockImplementation(async () => {
        const featureFlags = {};
        featureFlags[featureFlagKey] = true;
        return featureFlags;
      });

      applicationContext = await applicationContextCreator(context);

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

      await testCasesDxtrGateway.getCases(applicationContext, {});
      expect(querySpy.mock.calls[0][2]).toContain('UNION ALL');
      expect(querySpy.mock.calls[0][2]).toContain(`CS_CHAPTER = '${chapterNumber}'`);
    });

    test('should not return a chapter column in the result set when false.', async () => {
      const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
      featureFlagSpy.mockImplementation(async () => {
        return { 'chapter-twelve-enabled': false };
      });
      applicationContext = await applicationContextCreator(context);

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

      await testCasesDxtrGateway.getCases(applicationContext, {});
      expect(querySpy.mock.calls[0][2]).not.toContain('UNION ALL');
      expect(querySpy.mock.calls[0][2]).not.toContain("CS_CHAPTER = '12'");
    });
  });

  describe('partyQueryCallback', () => {
    test('should return null when no results are returned', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);

      expect(party).toBeNull();
    });

    test('should return expected debtor name', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              name: 'John   Q.   Smith',
            },
          ],
        },
        message: '',
      };

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);
      expect(party).toEqual({
        name: 'John Q. Smith',
      });
    });

    test('should return expected address fields', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              name: 'John Q. Smith',
              address1: '123 Main St',
              address2: 'Apt 17',
              address3: '',
              cityStateZipCountry: 'Queens NY     12345 USA',
            },
          ],
        },
        message: '',
      };

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);
      expect(party).toEqual({
        name: 'John Q. Smith',
        address1: '123 Main St',
        address2: 'Apt 17',
        address3: '',
        cityStateZipCountry: 'Queens NY 12345 USA',
      });
    });
  });

  describe('debtorAttorneyQueryCallback', () => {
    test('should return null when no results are returned', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const attorney = testCasesDxtrGateway.debtorAttorneyQueryCallback(
        applicationContext,
        queryResult,
      );

      expect(attorney).toBeNull();
    });

    test('should return expected attorney name', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              name: 'John   Q.   Smith',
            },
          ],
        },
        message: '',
      };

      const attorney = testCasesDxtrGateway.debtorAttorneyQueryCallback(
        applicationContext,
        queryResult,
      );

      expect(attorney).toEqual({
        name: 'John Q. Smith',
      });
    });

    test('should return expected attorney fields', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              name: 'John Q. Smith',
              address1: '123 Main St',
              address2: 'Apt 17',
              address3: '',
              cityStateZipCountry: 'Queens NY     12345 USA',
              phone: '9876543210',
              email: 'someone@email.com',
            },
          ],
        },
        message: '',
      };

      const attorney = testCasesDxtrGateway.debtorAttorneyQueryCallback(
        applicationContext,
        queryResult,
      );

      expect(attorney).toEqual({
        name: 'John Q. Smith',
        address1: '123 Main St',
        address2: 'Apt 17',
        address3: '',
        cityStateZipCountry: 'Queens NY 12345 USA',
        phone: '9876543210',
        email: 'someone@email.com',
      });
    });
  });

  describe('getSuggestedCases tests', () => {
    test('should return decorated transferred cases', async () => {
      // Test case summary
      const testCase = MockData.getCaseDetail();
      const mockTestCaseSummaryResponse = {
        success: true,
        results: {
          recordset: [testCase],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      const mockParties = {
        success: true,
        results: {
          recordset: [DEBTORS.get('081-22-23587')],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockParties);

      // Get suggested case data
      const mockSuggestedCases = [
        {
          ...CASE_SUMMARIES[0],
          debtorTypeCode: 'CB',
          petitionCode: 'TV',
          petitionLabel: undefined,
          debtorTypeLabel: undefined,
        },
        {
          ...CASE_SUMMARIES[1],
          debtorTypeCode: 'CB',
          petitionCode: 'VP',
          petitionLabel: undefined,
          debtorTypeLabel: undefined,
        },
      ];
      const mockSuggestedCasesResponse = {
        success: true,
        results: {
          recordset: mockSuggestedCases,
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockSuggestedCasesResponse);
      querySpy.mockResolvedValueOnce(mockParties);
      querySpy.mockResolvedValueOnce(mockParties);

      const actual = await testCasesDxtrGateway.getSuggestedCases(
        applicationContext,
        testCase.caseId,
      );

      expect(actual[0].debtorTypeLabel).toEqual('Corporate Business');
      expect(actual[0].petitionLabel).toEqual('Voluntary');
      expect(actual.length).toBe(1);
    });

    test('should throw CamsError when query fails to return valid response', async () => {
      // Test case summary
      const testCase = MockData.getCaseDetail();
      const mockTestCaseSummaryResponse = {
        success: true,
        results: {
          recordset: [testCase],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      const mockParties = {
        success: true,
        results: {
          recordset: [DEBTORS.get('081-22-23587')],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockParties);

      // Get suggested case data
      const mockSuggestedCasesResponse = {
        success: false,
        results: {
          recordset: [],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockSuggestedCasesResponse);
      querySpy.mockResolvedValueOnce(mockParties);
      querySpy.mockResolvedValueOnce(mockParties);

      await expect(
        testCasesDxtrGateway.getSuggestedCases(applicationContext, testCase.caseId),
      ).rejects.toThrow(CamsError);
    });
  });

  describe('searchCases tests', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test('should return empty array', async () => {
      const mockTestCaseSummaryResponse = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        caseNumber: '00-00000',
      });
      expect(actual).toEqual([]);
    });

    test('should return array of cases', async () => {
      const testCase = MockData.getCaseSummary();
      const testParty = MockData.getParty();
      const caseSummaryQueryResult = {
        success: true,
        results: {
          recordset: [testCase],
        },
        message: '',
      };
      const partyQueryResult = {
        success: true,
        results: {
          recordset: [testParty],
        },
        message: '',
      };
      querySpy
        .mockResolvedValueOnce(caseSummaryQueryResult)
        .mockResolvedValueOnce(partyQueryResult);

      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        caseNumber: '00-00000',
      });

      expect(actual).toEqual([testCase]);
    });

    test('should return an error', async () => {
      const errorMessage = 'query failed';
      const mockTestCaseSummaryResponse = {
        success: false,
        results: {},
        message: errorMessage,
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      await expect(
        testCasesDxtrGateway.searchCases(applicationContext, {
          caseNumber: '00-00000',
        }),
      ).rejects.toThrow(errorMessage);
    });
  });
});
