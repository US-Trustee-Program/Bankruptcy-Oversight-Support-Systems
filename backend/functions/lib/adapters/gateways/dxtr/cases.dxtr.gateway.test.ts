import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../../utils/application-context-creator';
import * as database from '../../utils/database';
import { QueryResults } from '../../types/database';
import * as mssql from 'mssql';
import { getYearMonthDayStringFromDate } from '../../utils/date-helper';
import { CaseDetailInterface } from '../../types/cases';
import * as featureFlags from '../../utils/feature-flag';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';

const context = require('azure-function-context-mock');
const dxtrDatabaseName = 'some-database-name';

function generateTestCase(overlay = {}) {
  const defaultReturn = {
    caseId: '081-23-12345',
    caseTitle: 'Debtor Two',
    dateFiled: '2019-04-18T00:00:00.000Z',
    dxtrId: '123',
    courtId: '567',
    chapter: '15',
    regionId: '02',
    courtDivision: '081',
    courtName: 'Fancy Court Name',
    courtDivisionName: 'Manhattan',
    debtorTypeLabel: 'Corporate Business',
  };
  return {
    ...defaultReturn,
    ...overlay,
  };
}

describe('Test DXTR Gateway', () => {
  let applicationContext;
  const querySpy = jest.spyOn(database, 'executeQuery');
  beforeEach(async () => {
    const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
    featureFlagSpy.mockImplementation(async () => {
      return {};
    });
    applicationContext = await applicationContextCreator(context);
    applicationContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    querySpy.mockImplementation(jest.fn());
  });
  afterEach(() => {
    jest.clearAllMocks();
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
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
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
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
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
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

    try {
      await testCasesDxtrGateway.getCases(applicationContext, {});
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as CamsError).message).toEqual(errorMessage);
    }
  });

  test('should return a single case when supplied a caseId', async () => {
    const testCase = generateTestCase();
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
        txRecord: 'zzzzzzzzzzzzzzzzzzz231115zzzzzzzzzzzz',
        txCode: 'CDC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231231zzzzzzzzzzzz',
        txCode: 'OCO',
      },
    ];

    const mockTransactionResults: QueryResults = {
      success: true,
      results: {
        recordset: transactions,
      },
      message: '',
    };

    const expectedParty = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };

    const mockQueryParties: QueryResults = {
      success: true,
      results: {
        recordset: [expectedParty],
      },
      message: '',
    };

    const expectedDebtorAttorney = {
      name: 'James Brown Esq.',
      address1: '456 South St',
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
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
    const expectedDebtorTypeLabel = 'Corporate Business';

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

    // First for the debtor type.
    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockDebtorTypeTransactionResults);
    });

    // Second time for the petition type.
    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockDebtorTypeTransactionResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryDebtorAttorney);
    });

    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getCaseDetail(
      applicationContext,
      testCase.caseId,
    );

    const closedDate = '2023-10-31';
    const dismissedDate = '2023-11-15';
    const reopenedDate = '2023-12-31';
    const expectedClose: CaseDetailInterface = {
      ...cases[0],
      closedDate,
      dismissedDate,
      reopenedDate,
    };
    expect(actualResult).toStrictEqual(expectedClose);
    expect(actualResult.regionId).toEqual(testCase.regionId);
    expect(actualResult.courtDivision).toEqual(testCase.courtDivision);
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
    const testCase = generateTestCase();
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
    const expectedDebtorTypeLabel = 'Corporate Business';

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

    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getCaseSummary(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.regionId).toEqual(testCase.regionId);
    expect(actualResult.courtDivision).toEqual(testCase.courtDivision);
    expect(actualResult.courtName).toEqual(testCase.courtName);
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
    const gateway: CasesDxtrGateway = new CasesDxtrGateway();
    await expect(gateway.getCaseSummary(applicationContext, '000-00-00000')).rejects.toThrow(
      expectedError,
    );
  });

  test('should call executeQuery with the expected properties for a case', async () => {
    const testCase = generateTestCase();
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

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockTransactionResults);
    });

    querySpy.mockImplementationOnce(async () => {
      return Promise.resolve(mockQueryDebtorAttorney);
    });

    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
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
    // getDebtorTypeLabel
    expect(querySpy.mock.calls[4][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
  });

  describe('Feature flag chapter-twelve-enabled', () => {
    test('should return a chapter column in the result set when true.', async () => {
      const featureFlagSpy = jest.spyOn(featureFlags, 'getFeatureFlags');
      featureFlagSpy.mockImplementation(async () => {
        return { 'chapter-twelve-enabled': true };
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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
      await testCasesDxtrGateway.getCases(applicationContext, {});
      expect(querySpy.mock.calls[0][2]).toContain('UNION ALL');
      expect(querySpy.mock.calls[0][2]).toContain("CS_CHAPTER = '12'");
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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);
      //store object as constant
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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);
      //store object as constant
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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

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

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
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

  describe('debtorTypeLabelCallback', () => {
    test('should return UNKNOWN when no results are returned', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const label = testCasesDxtrGateway.debtorTypeLabelCallback(applicationContext, queryResult);

      expect(label).toEqual('Debtor type information is not available.');
    });

    test('should return expected debtor type label', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              txRecord: '1081231056523-10565            15IB00-0000000',
            },
          ],
        },
        message: '',
      };

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const label = testCasesDxtrGateway.debtorTypeLabelCallback(applicationContext, queryResult);

      expect(label).toEqual('Individual Business');
    });
  });

  describe('petitionLabelCallback', () => {
    test('should return UNKNOWN when no results are returned', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const label = testCasesDxtrGateway.petitionInfoCallback(applicationContext, queryResult);

      expect(label).toEqual('');
    });

    test('should return expected petition label', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [
            {
              txRecord:
                '1081231056523-10565            15IB00-0000000     000000000000000000230411999992304119999923041110308230411VP000000',
            },
          ],
        },
        message: '',
      };

      const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();

      const label = testCasesDxtrGateway.petitionInfoCallback(applicationContext, queryResult);

      expect(label).toEqual('Voluntary');
    });
  });
});
