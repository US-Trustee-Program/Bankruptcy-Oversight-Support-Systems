import CasesDxtrGateway from './cases.dxtr.gateway';
import * as database from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { CaseDetail } from '../../../../../common/src/cams/cases';
import * as featureFlags from '../../utils/feature-flag';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CASE_SUMMARIES } from '../../../testing/mock-data/case-summaries.mock';
import { DEBTORS } from '../../../testing/mock-data/debtors.mock';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { LegacyTrustee } from '../../../../../common/src/cams/parties';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { TransactionIdRangeForDate } from '../../../use-cases/cases/cases.interface';

const dxtrDatabaseName = 'some-database-name';

describe('Test DXTR Gateway', () => {
  let applicationContext;
  let testCasesDxtrGateway;
  let querySpy;

  beforeEach(async () => {
    const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
    featureFlagSpy.mockImplementation(async () => {
      return {};
    });
    querySpy = jest.spyOn(database, 'executeQuery');

    applicationContext = await createMockApplicationContext();
    applicationContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    testCasesDxtrGateway = new CasesDxtrGateway();

    querySpy.mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    await expect(testCasesDxtrGateway.searchCases(applicationContext, {})).rejects.toThrow(
      errorMessage,
    );
  });

  test('should return a single case when supplied a caseId', async () => {
    const closedDate = '2023-10-31';
    const dismissedDate = '2023-11-15';
    const reopenedDate = '2023-12-31';
    const transferDate = '2023-12-31';

    const expectedParty = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };

    const expectedTrusteeRecord = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
      email: 'john.smith@example.com',
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
        trustee: MockData.getLegacyTrustee({ name: 'placeholder' }), // This will be replaced by gateway
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
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231231zzzzzzzzzzzz',
        txCode: 'CTO',
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

    const mockQueryTrustee: QueryResults = {
      success: true,
      results: {
        recordset: [expectedTrusteeRecord],
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
      return Promise.resolve(mockQueryTrustee);
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
      transferDate,
      trustee: {
        name: 'John Q. Smith',
        legacy: {
          address1: '123 Main St',
          address2: 'Apt 17',
          address3: '',
          cityStateZipCountry: 'Queens NY 12345 USA',
          email: 'john.smith@example.com',
          phone: '101-345-8765',
        },
      } as LegacyTrustee,
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
    const caseId = '000-00-00000';
    const expectedError = new NotFoundError('CASES-DXTR-GATEWAY', {
      message: `Case summary not found for case ID: ${caseId}.`,
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
    await expect(testCasesDxtrGateway.getCaseSummary(applicationContext, caseId)).rejects.toThrow(
      expectedError,
    );
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

    const expectedTrusteeRecord = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
    };

    const mockQueryTrustee: QueryResults = {
      success: true,
      results: {
        recordset: [expectedTrusteeRecord],
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
      return Promise.resolve(mockQueryTrustee);
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
      const testCase = MockData.getCaseSummary();
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
    const testCase = MockData.getCaseSummary({ override: { caseId: '999-00-00000' } });
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

    beforeEach(() => {
      querySpy
        .mockResolvedValueOnce(caseSummaryQueryResult)
        .mockResolvedValueOnce(partyQueryResult);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return empty array', async () => {
      jest.resetAllMocks();
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

    test('should return array of cases for a given court division', async () => {
      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        divisionCodes: ['999'],
      });
      expect(actual).toEqual([testCase]);
    });

    test('should return array of cases for a given case number', async () => {
      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        caseNumber: '00-00000',
      });

      expect(actual).toEqual([testCase]);
    });

    test('should return array of cases for a given list of caseIds', async () => {
      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        caseIds: ['999-00-00000', '999-11-22222'],
      });

      expect(actual).toEqual([testCase]);
    });

    test('should return array of cases for a given list of chapters', async () => {
      const actual = await testCasesDxtrGateway.searchCases(applicationContext, {
        chapters: ['15'],
      });

      expect(actual).toEqual([testCase]);
    });

    test('should call execute query with no chapters if none exist in the searchPredicate', async () => {
      await testCasesDxtrGateway.searchCases(applicationContext, {
        caseNumber: '00-00000',
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.not.stringContaining('cs.CS_CHAPTER IN'),
        expect.anything(),
      );
    });

    test('should call execute query with chapters within the searchPredicate', async () => {
      await testCasesDxtrGateway.searchCases(applicationContext, {
        chapters: ['15'],
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("cs.CS_CHAPTER IN ('15')"),
        expect.anything(),
      );
    });

    test('should return an error', async () => {
      jest.resetAllMocks();
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

  describe('findTransactionIdRangeForDate', () => {
    const dateRangeMock = (_context, _config, query: string, params: DbTableFieldSpec[]) => {
      const mockTxMap = new Map<number, string>([
        [100, '2024-01-01'],
        [101, '2024-01-01'],
        [102, '2024-01-01'],
        [103, '2024-02-01'],
        [104, '2024-02-01'],
        [105, '2024-03-01'],
        [106, '2024-03-01'],
        [107, '2024-03-01'],
        [108, '2024-03-01'],
        [109, '2024-04-01'],
        [110, '2024-05-01'],
      ]);

      let recordset = [];

      if (query.includes('MAX_TX_ID')) {
        recordset = [{ MAX_TX_ID: 110 }];
      }

      if (query.includes('MIN_TX_ID')) {
        recordset = [{ MIN_TX_ID: 100 }];
      }

      if (query.includes('TX_DATE')) {
        const txId = params[0].value as number;
        if (mockTxMap.has(txId)) {
          const TX_DATE = mockTxMap.get(txId);
          recordset = [{ TX_DATE }];
        }
      }

      const results: QueryResults = {
        success: true,
        results: {
          recordset,
        },
        message: '',
      };

      return Promise.resolve(results);
    };

    const boundTestCase = [
      [
        '1990-01-01',
        {
          findDate: '1990-01-01',
          found: false,
        },
      ],
      [
        '2070-01-01',
        {
          findDate: '2070-01-01',
          found: false,
        },
      ],
      [
        '2024-03-01',
        {
          findDate: '2024-03-01',
          found: true,
          start: 105,
          end: 108,
        },
      ],
      [
        '2024-04-01',
        {
          findDate: '2024-04-01',
          found: true,
          start: 109,
          end: 109,
        },
      ],
    ];
    test.each(boundTestCase)(
      'should find the transaction id bounds in the AO_TX table for %s',
      async (findDate: string, expected: TransactionIdRangeForDate) => {
        querySpy.mockImplementation(dateRangeMock);
        const actual = await testCasesDxtrGateway.findTransactionIdRangeForDate(
          applicationContext,
          findDate,
        );
        expect(actual).toEqual(expected);
      },
    );
  });

  describe('getUpdatedCaseIds', () => {
    test('should return a list of updated case ids', async () => {
      const recordset = MockData.buildArray(MockData.randomCaseId, 100).map((caseId) => {
        return { caseId };
      });

      const executeResults: QueryResults = {
        success: true,
        results: {
          recordset,
        },
        message: '',
      };

      const expectedReturn = recordset.map((record) => record.caseId);

      querySpy.mockImplementationOnce(async () => {
        return executeResults;
      });

      const startDate = new Date().toISOString();
      const actual = await testCasesDxtrGateway.getUpdatedCaseIds(applicationContext, startDate);
      expect(actual).toEqual(expectedReturn);
    });

    test('should return an empty array', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      querySpy.mockReturnValue(mockResults);
      const actual = await testCasesDxtrGateway.getUpdatedCaseIds(applicationContext, 'foo');
      expect(actual).toEqual([]);
    });
  });
});
