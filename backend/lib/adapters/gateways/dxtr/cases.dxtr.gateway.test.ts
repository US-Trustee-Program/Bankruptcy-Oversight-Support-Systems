import { vi } from 'vitest';
import CasesDxtrGateway from './cases.dxtr.gateway';
import * as database from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import { CaseDetail } from '@common/cams/cases';
import * as featureFlags from '../../utils/feature-flag';
import { CamsError } from '../../../common-errors/cams-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CASE_SUMMARIES } from '../../../testing/mock-data/case-summaries.mock';
import { DEBTORS } from '../../../testing/mock-data/debtors.mock';
import MockData from '@common/cams/test-utilities/mock-data';
import { LegacyTrustee, Party, Debtor, DebtorAttorney } from '@common/cams/parties';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { TransactionIdRangeForDate } from '../../../use-cases/cases/cases.interface';
import { DxtrTransactionRecord } from '../../types/cases';

const dxtrDatabaseName = 'some-database-name';

// Test helper functions
const buildDebtor = (overrides: Partial<Debtor> = {}): Debtor => ({
  name: 'John Q. Smith',
  address1: '123 Main St',
  address2: 'Apt 17',
  address3: '',
  cityStateZipCountry: 'Queens NY 12345 USA',
  ssn: '123-45-6789',
  taxId: '12-3456789',
  ...overrides,
});

const buildJointDebtor = (overrides: Partial<Debtor> = {}): Debtor =>
  buildDebtor({
    name: 'Jane Q. Smith',
    ssn: '987-65-4321',
    taxId: '98-7654321',
    ...overrides,
  });

const buildAttorney = (overrides: Partial<DebtorAttorney> = {}): DebtorAttorney => ({
  name: 'James Brown Esq.',
  address1: '456 South St',
  address2: undefined,
  address3: undefined,
  cityStateZipCountry: 'Queens NY 12345 USA',
  phone: '101-345-8765',
  email: undefined,
  office: undefined,
  ...overrides,
});

const buildJointDebtorAttorney = (overrides: Partial<DebtorAttorney> = {}): DebtorAttorney =>
  buildAttorney({
    name: 'Sarah Green Esq.',
    address1: '789 North Ave',
    cityStateZipCountry: 'Brooklyn NY 11201 USA',
    phone: '101-987-6543',
    ...overrides,
  });

const buildTrustee = (overrides: Partial<Party> = {}): Party => ({
  name: 'Robert Trustee',
  address1: '789 Trust St',
  address2: 'Suite 100',
  address3: '',
  cityStateZipCountry: 'Manhattan NY 10001 USA',
  phone: '212-555-1234',
  email: 'robert.trustee@example.com',
  ...overrides,
});

const makeQueryResults = <T>(recordset: T[]): QueryResults => ({
  success: true,
  results: { recordset },
  message: '',
});

const buildTransaction = (
  overrides: Partial<DxtrTransactionRecord> = {},
): DxtrTransactionRecord => ({
  txRecord: 'zzzzzzzzzzzzzzzzzzz000000zzzzzzzzzzzz',
  txCode: 'CBC',
  ...overrides,
});

type CaseDetailQueryMocks = {
  caseResults: QueryResults;
  debtorResults: QueryResults;
  debtorAliasResults?: QueryResults;
  jointDebtorResults: QueryResults;
  jointDebtorAliasResults?: QueryResults;
  transactionResults: QueryResults;
  trusteeResults: QueryResults;
  debtorAttorneyResults: QueryResults;
  jointDebtorAttorneyResults: QueryResults;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setupCaseDetailQuerySequence = (querySpy: any, mocks: CaseDetailQueryMocks) => {
  querySpy.mockImplementationOnce(async () => mocks.caseResults);
  querySpy.mockImplementationOnce(async () => mocks.debtorResults);
  if (mocks.debtorAliasResults) {
    querySpy.mockImplementationOnce(async () => mocks.debtorAliasResults);
  }
  querySpy.mockImplementationOnce(async () => mocks.jointDebtorResults);
  if (mocks.jointDebtorAliasResults) {
    querySpy.mockImplementationOnce(async () => mocks.jointDebtorAliasResults);
  }
  querySpy.mockImplementationOnce(async () => mocks.transactionResults);
  querySpy.mockImplementationOnce(async () => mocks.trusteeResults);
  querySpy.mockImplementationOnce(async () => mocks.debtorAttorneyResults);
  querySpy.mockImplementationOnce(async () => mocks.jointDebtorAttorneyResults);
};

describe('Test DXTR Gateway', () => {
  let applicationContext;
  let testCasesDxtrGateway;
  let querySpy;

  beforeEach(async () => {
    const featureFlagSpy = vi.spyOn(featureFlags, 'getFeatureFlags');
    featureFlagSpy.mockImplementation(async () => {
      return {};
    });
    querySpy = vi.spyOn(database, 'executeQuery');

    applicationContext = await createMockApplicationContext();
    applicationContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    testCasesDxtrGateway = new CasesDxtrGateway();

    querySpy.mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TODO: Find a way to cover the different scenarios where executeQuery throws an error
  test('should throw error when executeQuery returns success=false', async () => {
    const errorMessage = 'There was some fake error.';
    const mockResults: QueryResults = {
      success: false,
      results: {},
      message: errorMessage,
    };
    querySpy.mockResolvedValue(mockResults);

    await expect(testCasesDxtrGateway.searchCases(applicationContext, {})).rejects.toThrow(
      errorMessage,
    );
  });

  test('should return a single case when supplied a caseId', async () => {
    const closedDate = '2023-10-31';
    const dismissedDate = '2023-11-15';
    const reopenedDate = '2023-12-31';
    const transferDate = '2023-12-31';

    const expectedDebtor = buildDebtor();
    const expectedJointDebtor = buildJointDebtor();
    const expectedTrusteeRecord = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
      email: 'john.smith@example.com',
    };
    const expectedDebtorAttorney = buildAttorney();
    const expectedJointDebtorAttorney = buildJointDebtorAttorney();
    const expectedDebtorTypeLabel = 'Corporate Business';

    const testCase = MockData.getCaseDetail({
      entityType: 'company',
      override: {
        debtor: expectedDebtor,
        jointDebtor: expectedJointDebtor,
        debtorAttorney: expectedDebtorAttorney,
        jointDebtorAttorney: expectedJointDebtorAttorney,
        debtorTypeCode: 'CB',
        debtorTypeLabel: expectedDebtorTypeLabel,
        regionId: '04',
        trustee: MockData.getLegacyTrustee({ name: 'placeholder' }), // This will be replaced by gateway
      },
    });

    const transactions = [
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz230830zzzzzzzzzzzz', txCode: 'CBC' }),
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz', txCode: 'CBC' }),
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz231115zzzzzzzzzzzz', txCode: 'CDC' }),
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz231231zzzzzzzzzzzz', txCode: 'OCO' }),
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz231231zzzzzzzzzzzz', txCode: 'CTO' }),
    ];

    setupCaseDetailQuerySequence(querySpy, {
      caseResults: makeQueryResults([testCase]),
      debtorResults: makeQueryResults([expectedDebtor]),
      debtorAliasResults: makeQueryResults([]),
      jointDebtorResults: makeQueryResults([expectedJointDebtor]),
      jointDebtorAliasResults: makeQueryResults([]),
      transactionResults: makeQueryResults(transactions),
      trusteeResults: makeQueryResults([expectedTrusteeRecord]),
      debtorAttorneyResults: makeQueryResults([expectedDebtorAttorney]),
      jointDebtorAttorneyResults: makeQueryResults([expectedJointDebtorAttorney]),
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
    expect(actualResult.debtor).toEqual(expectedDebtor);
    expect(actualResult.jointDebtor).toEqual(expectedJointDebtor);
    expect(actualResult.debtorAttorney).toEqual(expectedDebtorAttorney);
    expect(actualResult.jointDebtorAttorney).toEqual(expectedJointDebtorAttorney);
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

    querySpy.mockResolvedValueOnce(mockCaseResults);

    querySpy.mockResolvedValueOnce(mockQueryParties);

    // First for the debtor type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

    // Second time for the petition type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

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

  test('should return a case summary with joint debtor when joint debtor exists', async () => {
    const expectedDebtorTypeLabel = 'Joint Consumer';
    const expectedDebtor = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };
    const expectedJointDebtor = {
      name: 'Jane Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '987-65-4321',
      taxId: '98-7654321',
    };

    const testCase = MockData.getCaseDetail({
      entityType: 'person',
      override: {
        debtorTypeCode: 'JC',
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

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [expectedDebtor],
      },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [expectedJointDebtor],
      },
      message: '',
    };

    const mockDebtorTypeTransactionResults = {
      success: true,
      results: {
        recordset: [
          {
            txRecord:
              '1081201013220-10132            15JC               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
            txCode: '1',
          },
        ],
      },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);

    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    // First for the debtor type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

    // Second time for the petition type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

    const actualResult = await testCasesDxtrGateway.getCaseSummary(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.debtor).toEqual(expectedDebtor);
    expect(actualResult.jointDebtor).toEqual(expectedJointDebtor);
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
    expect(actualResult.petitionLabel).toEqual('Voluntary');
  });

  test('should return a case summary without joint debtor when joint debtor does not exist', async () => {
    const expectedDebtorTypeLabel = 'Individual Consumer';
    const expectedDebtor = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };

    const testCase = MockData.getCaseDetail({
      entityType: 'person',
      override: {
        debtorTypeCode: 'IC',
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

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [expectedDebtor],
      },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [],
      },
      message: '',
    };

    const mockDebtorTypeTransactionResults = {
      success: true,
      results: {
        recordset: [
          {
            txRecord:
              '1081201013220-10132            15IC               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
            txCode: '1',
          },
        ],
      },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);

    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    // First for the debtor type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

    // Second time for the petition type.
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);

    const actualResult = await testCasesDxtrGateway.getCaseSummary(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.debtor).toEqual(expectedDebtor);
    expect(actualResult.jointDebtor).toBeUndefined();
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
    expect(actualResult.petitionLabel).toEqual('Voluntary');
  });

  test('should return case detail with joint debtor and joint debtor attorney', async () => {
    const closedDate = '2023-10-31';
    const dismissedDate = '2023-11-15';

    const expectedDebtor = {
      name: 'John Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '123-45-6789',
      taxId: '12-3456789',
    };

    const expectedJointDebtor = {
      name: 'Jane Q. Smith',
      address1: '123 Main St',
      address2: 'Apt 17',
      address3: '',
      cityStateZipCountry: 'Queens NY 12345 USA',
      ssn: '987-65-4321',
      taxId: '98-7654321',
    };

    const expectedTrusteeRecord = {
      name: 'Robert Trustee',
      address1: '789 Trust St',
      address2: 'Suite 100',
      address3: '',
      cityStateZipCountry: 'Manhattan NY 10001 USA',
      phone: '212-555-1234',
      email: 'robert.trustee@example.com',
    };

    const expectedDebtorAttorney = {
      name: 'James Brown Esq.',
      address1: '456 South St',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Queens NY 12345 USA',
      phone: '101-345-8765',
      email: 'jbrown@lawfirm.com',
      office: 'Brown & Associates',
    };

    const expectedJointDebtorAttorney = {
      name: 'Sarah Green Esq.',
      address1: '789 North Ave',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Brooklyn NY 11201 USA',
      phone: '101-987-6543',
      email: 'sgreen@attorneys.com',
      office: 'Green Legal Group',
    };

    const expectedDebtorTypeLabel = 'Joint Consumer';

    const testCase = MockData.getCaseDetail({
      entityType: 'person',
      override: {
        debtor: expectedDebtor,
        jointDebtor: expectedJointDebtor,
        debtorAttorney: expectedDebtorAttorney,
        jointDebtorAttorney: expectedJointDebtorAttorney,
        debtorTypeCode: 'JC',
        debtorTypeLabel: expectedDebtorTypeLabel,
        regionId: '04',
        trustee: MockData.getLegacyTrustee({ name: 'placeholder' }),
      },
    });

    const cases = [testCase];

    const transactions = [
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz',
        txCode: 'CBC',
      },
      {
        txRecord: 'zzzzzzzzzzzzzzzzzzz231115zzzzzzzzzzzz',
        txCode: 'CDC',
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

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [expectedDebtor],
      },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [expectedJointDebtor],
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

    const mockQueryJointDebtorAttorney: QueryResults = {
      success: true,
      results: {
        recordset: [expectedJointDebtorAttorney],
      },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);

    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockTransactionResults);

    querySpy.mockResolvedValueOnce(mockQueryTrustee);

    querySpy.mockResolvedValueOnce(mockQueryDebtorAttorney);

    querySpy.mockResolvedValueOnce(mockQueryJointDebtorAttorney);

    const actualResult = await testCasesDxtrGateway.getCaseDetail(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.closedDate).toEqual(closedDate);
    expect(actualResult.dismissedDate).toEqual(dismissedDate);
    expect(actualResult.debtor).toEqual(expectedDebtor);
    expect(actualResult.jointDebtor).toEqual(expectedJointDebtor);
    expect(actualResult.debtorAttorney).toEqual(expectedDebtorAttorney);
    expect(actualResult.jointDebtorAttorney).toEqual(expectedJointDebtorAttorney);
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
    expect(actualResult.trustee.name).toEqual('Robert Trustee');
  });

  test('should return case detail without joint debtor and joint debtor attorney', async () => {
    const closedDate = '2023-10-31';

    const expectedDebtor = buildDebtor();
    const expectedTrusteeRecord = buildTrustee();
    const expectedDebtorAttorney = buildAttorney({
      email: 'jbrown@lawfirm.com',
      office: 'Brown & Associates',
    });
    const expectedDebtorTypeLabel = 'Individual Consumer';

    const testCase = MockData.getCaseDetail({
      entityType: 'person',
      override: {
        debtor: expectedDebtor,
        debtorAttorney: expectedDebtorAttorney,
        debtorTypeCode: 'IC',
        debtorTypeLabel: expectedDebtorTypeLabel,
        regionId: '04',
        trustee: MockData.getLegacyTrustee({ name: 'placeholder' }),
      },
    });

    const transactions = [
      buildTransaction({ txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz', txCode: 'CBC' }),
    ];

    setupCaseDetailQuerySequence(querySpy, {
      caseResults: makeQueryResults([testCase]),
      debtorResults: makeQueryResults([expectedDebtor]),
      debtorAliasResults: makeQueryResults([]),
      jointDebtorResults: makeQueryResults([]),
      transactionResults: makeQueryResults(transactions),
      trusteeResults: makeQueryResults([expectedTrusteeRecord]),
      debtorAttorneyResults: makeQueryResults([expectedDebtorAttorney]),
      jointDebtorAttorneyResults: makeQueryResults([]),
    });

    const actualResult = await testCasesDxtrGateway.getCaseDetail(
      applicationContext,
      testCase.caseId,
    );

    expect(actualResult.closedDate).toEqual(closedDate);
    expect(actualResult.debtor).toEqual(expectedDebtor);
    expect(actualResult.jointDebtor).toBeUndefined();
    expect(actualResult.debtorAttorney).toEqual(expectedDebtorAttorney);
    expect(actualResult.jointDebtorAttorney).toBeUndefined();
    expect(actualResult.debtorTypeLabel).toEqual(expectedDebtorTypeLabel);
    expect(actualResult.trustee.name).toEqual('Robert Trustee');
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

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: {
        recordset: [{ partyName: 'Jane Q. Smith' }],
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

    const expectedJointDebtorAttorney = {
      name: 'Sarah Green Esq.',
      address1: '789 North Ave',
      cityStateZipCountry: 'Brooklyn NY 11201 USA',
      phone: '101-987-6543',
    };

    const mockQueryJointDebtorAttorney: QueryResults = {
      success: true,
      results: {
        recordset: [expectedJointDebtorAttorney],
      },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);

    querySpy.mockResolvedValueOnce(mockQueryParties);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));

    querySpy.mockResolvedValueOnce(mockTransactionResults);

    querySpy.mockResolvedValueOnce(mockQueryTrustee);

    querySpy.mockResolvedValueOnce(mockQueryDebtorAttorney);

    querySpy.mockResolvedValueOnce(mockQueryJointDebtorAttorney);

    await testCasesDxtrGateway.getCaseDetail(applicationContext, '081-23-12345');
    // getCase
    expect(querySpy.mock.calls[0][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrCaseId', value: '23-12345' }),
        expect.objectContaining({ name: 'courtDiv', value: '081' }),
      ]),
    );
    // getDebtors
    expect(querySpy.mock.calls[1][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtorAliases
    expect(querySpy.mock.calls[2][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtors
    expect(querySpy.mock.calls[3][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtorAliases
    expect(querySpy.mock.calls[4][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getTransactions
    expect(querySpy.mock.calls[5][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getTrustee
    expect(querySpy.mock.calls[6][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtorAttorneys
    expect(querySpy.mock.calls[7][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtorAttorneys
    expect(querySpy.mock.calls[8][3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
  });

  describe('partyQueryCallback', () => {
    test('should return undefined when no results are returned', async () => {
      const queryResult: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const party = testCasesDxtrGateway.partyQueryCallback(applicationContext, queryResult);

      expect(party).toBeUndefined();
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
    test('should return undefined when no results are returned', async () => {
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

      expect(attorney).toBeUndefined();
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
      // debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));

      const mockJointDebtor = {
        success: true,
        results: {
          recordset: [{ partyName: 'Jane Q. Smith' }],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockJointDebtor);
      // joint debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));

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
      // suggested case 1 debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));
      querySpy.mockResolvedValueOnce(mockParties);
      // suggested case 2 debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));

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

      const mockJointDebtor = {
        success: true,
        results: {
          recordset: [{ partyName: 'Jane Q. Smith' }],
        },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockJointDebtor);

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
      vi.restoreAllMocks();
    });

    test('should return empty array', async () => {
      vi.resetAllMocks();
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
      vi.resetAllMocks();
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
    test('should return case ids and latest sync date from first record', async () => {
      const latestCasesSyncDate = '2025-02-11T10:30:00.124Z';
      const latestTransactionsSyncDate = '2025-02-11T12:45:00.789Z';

      // Mock results for AO_CS query
      const casesRecordset = MockData.buildArray(MockData.randomCaseId, 50).map((caseId, idx) => {
        const syncDate = idx === 0 ? latestCasesSyncDate : '2025-02-10T08:00:00.000Z';
        return { caseId, latestSyncDate: syncDate };
      });

      // Mock results for AO_TX query
      const transactionsRecordset = MockData.buildArray(MockData.randomCaseId, 50).map(
        (caseId, idx) => {
          const syncDate = idx === 0 ? latestTransactionsSyncDate : '2025-02-10T09:00:00.000Z';
          return { caseId, latestSyncDate: syncDate };
        },
      );

      const casesResults: QueryResults = {
        success: true,
        results: { recordset: casesRecordset },
        message: '',
      };

      const transactionsResults: QueryResults = {
        success: true,
        results: { recordset: transactionsRecordset },
        message: '',
      };

      // All case IDs from both queries (Set handles deduplication)
      const allCaseIds = new Set([
        ...casesRecordset.map((r) => r.caseId),
        ...transactionsRecordset.map((r) => r.caseId),
      ]);

      // Mock both query calls - cases first, then transactions
      querySpy.mockResolvedValueOnce(casesResults);
      querySpy.mockResolvedValueOnce(transactionsResults);

      const casesStart = new Date().toISOString();
      const transactionsStart = new Date().toISOString();
      const actual = await testCasesDxtrGateway.getUpdatedCaseIds(
        applicationContext,
        casesStart,
        transactionsStart,
      );

      expect(actual.caseIds).toHaveLength(allCaseIds.size);
      expect(actual.latestCasesSyncDate).toEqual(latestCasesSyncDate);
      expect(actual.latestTransactionsSyncDate).toEqual(latestTransactionsSyncDate);
    });

    test('should return empty array and original start dates when no results', async () => {
      const emptyResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      const casesStart = '2025-02-11T08:00:00.000Z';
      const transactionsStart = '2025-02-11T09:00:00.000Z';

      // Both queries return empty
      querySpy.mockResolvedValueOnce(emptyResults);
      querySpy.mockResolvedValueOnce(emptyResults);

      const actual = await testCasesDxtrGateway.getUpdatedCaseIds(
        applicationContext,
        casesStart,
        transactionsStart,
      );

      expect(actual).toEqual({
        caseIds: [],
        latestCasesSyncDate: casesStart,
        latestTransactionsSyncDate: transactionsStart,
      });
    });

    test('should return cases updated via LAST_UPDATE_DATE (from AO_CS)', async () => {
      const casesResults = makeQueryResults([
        { caseId: '081-20-10508', latestSyncDate: '2025-02-11T10:00:00.000Z' },
        { caseId: '081-21-12345', latestSyncDate: '2025-02-11T09:00:00.000Z' },
      ]);
      const emptyResults = makeQueryResults([]);

      // Cases query returns data, transactions query is empty
      querySpy.mockResolvedValueOnce(casesResults);
      querySpy.mockResolvedValueOnce(emptyResults);

      const result = await testCasesDxtrGateway.getUpdatedCaseIds(
        applicationContext,
        '2024-01-01',
        '2024-01-01',
      );

      expect(result.caseIds).toEqual(['081-20-10508', '081-21-12345']);
      expect(result.latestCasesSyncDate).toEqual('2025-02-11T10:00:00.000Z');
    });

    test('should include cases with terminal transactions from AO_TX', async () => {
      const emptyResults = makeQueryResults([]);
      const transactionsResults = makeQueryResults([
        { caseId: '081-20-10508', latestSyncDate: '2025-02-11T14:00:00.000Z' },
      ]);

      // Cases query is empty, transactions query returns data
      querySpy.mockResolvedValueOnce(emptyResults);
      querySpy.mockResolvedValueOnce(transactionsResults);

      const result = await testCasesDxtrGateway.getUpdatedCaseIds(
        applicationContext,
        '2024-01-01',
        '2024-01-01',
      );

      expect(result.caseIds).toContain('081-20-10508');
      expect(result.latestTransactionsSyncDate).toEqual('2025-02-11T14:00:00.000Z');
    });

    test('should deduplicate cases found in both AO_CS and AO_TX queries', async () => {
      // Same case ID returned from both queries
      const casesResults = makeQueryResults([
        { caseId: '081-20-10508', latestSyncDate: '2025-02-11T10:00:00.000Z' },
      ]);
      const transactionsResults = makeQueryResults([
        { caseId: '081-20-10508', latestSyncDate: '2025-02-11T14:00:00.000Z' },
      ]);

      querySpy.mockResolvedValueOnce(casesResults);
      querySpy.mockResolvedValueOnce(transactionsResults);

      const result = await testCasesDxtrGateway.getUpdatedCaseIds(
        applicationContext,
        '2024-01-01',
        '2024-01-01',
      );

      expect(result.caseIds).toEqual(['081-20-10508']); // Only once, Set handles deduplication
      expect(result.latestCasesSyncDate).toEqual('2025-02-11T10:00:00.000Z');
      expect(result.latestTransactionsSyncDate).toEqual('2025-02-11T14:00:00.000Z');
    });
  });

  describe('getCasesWithTerminalTransactionBlindSpot', () => {
    test('should return cases with TX_DATE > LAST_UPDATE_DATE', async () => {
      const mockResults = makeQueryResults([
        { caseId: '081-20-10508' },
        { caseId: '081-21-12345' },
      ]);
      querySpy.mockResolvedValue(mockResults);

      const result = await testCasesDxtrGateway.getCasesWithTerminalTransactionBlindSpot(
        applicationContext,
        '2018-01-01',
      );

      expect(result).toEqual(['081-20-10508', '081-21-12345']);
      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining(
          "TX.TX_DATE AT TIME ZONE 'UTC' > C.LAST_UPDATE_DATE AT TIME ZONE 'UTC'",
        ),
        expect.arrayContaining([
          expect.objectContaining({ name: 'cutoffDate', value: '2018-01-01' }),
        ]),
      );
    });

    test('should include all terminal transaction codes', async () => {
      querySpy.mockResolvedValue(makeQueryResults([]));

      await testCasesDxtrGateway.getCasesWithTerminalTransactionBlindSpot(
        applicationContext,
        '2018-01-01',
      );

      const query = querySpy.mock.calls[0][2];
      expect(query).toContain("TX.TX_CODE IN ('CBC', 'CDC', 'OCO', 'CTO')");
    });

    test('should filter by TX_TYPE = O', async () => {
      querySpy.mockResolvedValue(makeQueryResults([]));

      await testCasesDxtrGateway.getCasesWithTerminalTransactionBlindSpot(
        applicationContext,
        '2018-01-01',
      );

      const query = querySpy.mock.calls[0][2];
      expect(query).toContain("TX.TX_TYPE = 'O'");
    });
  });

  describe('queryPartyAdditionalIdentifiers tests', () => {
    test('should return deduplicated, sorted, and formatted additionalIdentifiers (names, SSNs, tax IDs)', async () => {
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'name', value: 'Zachary Smith' },
        { aliasType: 'name', value: 'John   Q.   Smith' },
        { aliasType: 'name', value: 'John   Q.   Smith' },
        { aliasType: 'name', value: 'Adam Brown' },
        { aliasType: 'name', value: 'Michael  J  Smith' },
        { aliasType: 'ssn', value: '222-22-2222' },
        { aliasType: 'ssn', value: '111-11-1111' },
        { aliasType: 'ssn', value: '111-11-1111' },
        { aliasType: 'taxId', value: '98-7654321' },
        { aliasType: 'taxId', value: '12-3456789' },
      ]);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const additionalIdentifiers = await testCasesDxtrGateway.queryPartyAdditionalIdentifiers(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(additionalIdentifiers.names).toEqual([
        'Adam Brown',
        'John Q. Smith',
        'Michael J Smith',
        'Zachary Smith',
      ]);
      expect(additionalIdentifiers.ssns).toEqual(['111-11-1111', '222-22-2222']);
      expect(additionalIdentifiers.taxIds).toEqual(['12-3456789', '98-7654321']);
    });

    test('should filter out empty/null values', async () => {
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'name', value: 'John Smith' },
        { aliasType: 'name', value: '   ' },
        { aliasType: 'name', value: 'Jane Doe' },
        { aliasType: 'name', value: '' },
        { aliasType: 'ssn', value: '111-11-1111' },
        { aliasType: 'ssn', value: '' },
        { aliasType: 'taxId', value: '12-3456789' },
      ]);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const additionalIdentifiers = await testCasesDxtrGateway.queryPartyAdditionalIdentifiers(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(additionalIdentifiers.names).toEqual(['Jane Doe', 'John Smith']);
      expect(additionalIdentifiers.ssns).toEqual(['111-11-1111']);
      expect(additionalIdentifiers.taxIds).toEqual(['12-3456789']);
    });

    test('should return undefined when no additionalIdentifiers exist', async () => {
      const aliasQueryResult = makeQueryResults([]);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const additionalIdentifiers = await testCasesDxtrGateway.queryPartyAdditionalIdentifiers(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(additionalIdentifiers).toBeUndefined();
    });

    test('should return undefined and log warning on query failure', async () => {
      const logSpy = vi.spyOn(applicationContext.logger, 'warn');
      querySpy.mockRejectedValueOnce(new Error('Database connection failed'));

      const additionalIdentifiers = await testCasesDxtrGateway.queryPartyAdditionalIdentifiers(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(additionalIdentifiers).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        'CASES-DXTR-GATEWAY',
        "Failed to query party's additional identifiers",
        expect.any(Error),
      );
    });

    test('should use correct SQL join keys and query all three tables', async () => {
      const aliasQueryResult = makeQueryResults([]);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      await testCasesDxtrGateway.queryPartyAdditionalIdentifiers(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      const query = querySpy.mock.calls[0][2];
      expect(query).toContain('CS_CASEID = @dxtrId');
      expect(query).toContain('COURT_ID = @courtId');
      expect(query).toContain('PY_ROLE = @partyCode');
      expect(query).toContain('FROM [dbo].[AO_ALIAS]');
      expect(query).toContain('FROM [dbo].[AO_SSN]');
      expect(query).toContain('FROM [dbo].[AO_TAXID]');
      expect(query).toContain('UNION');
      expect(query).toContain('PY_SSN_SEQ > 0');
      expect(query).toContain('PY_TAXID_SEQ > 0');
    });
  });

  describe('queryDebtorParty with additionalIdentifiers tests', () => {
    test('should add additionalIdentifiers.names to Debtor when name additionalIdentifiers exist', async () => {
      const debtorQueryResult = makeQueryResults([buildDebtor()]);
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'name', value: 'Michael J Smith' },
        { aliasType: 'name', value: 'John Smith' },
      ]);

      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeDefined();
      expect(debtor?.additionalIdentifiers?.names).toEqual(['John Smith', 'Michael J Smith']);
    });

    test('should add additionalIdentifiers.ssns when alias SSNs exist', async () => {
      const debtorQueryResult = makeQueryResults([buildDebtor({ ssn: '111-11-1111' })]);
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'ssn', value: '222-22-2222' },
        { aliasType: 'ssn', value: '333-33-3333' },
      ]);

      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeDefined();
      expect(debtor?.additionalIdentifiers?.ssns).toEqual(['222-22-2222', '333-33-3333']);
      expect(debtor?.ssn).toBe('111-11-1111');
    });

    test('should add additionalIdentifiers.taxIds when alias tax IDs exist', async () => {
      const debtorQueryResult = makeQueryResults([buildDebtor({ taxId: '12-3456789' })]);
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'taxId', value: '98-7654321' },
        { aliasType: 'taxId', value: '11-1111111' },
      ]);

      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeDefined();
      expect(debtor?.additionalIdentifiers?.taxIds).toEqual(['11-1111111', '98-7654321']);
      expect(debtor?.taxId).toBe('12-3456789');
    });

    test('should handle all three alias types together', async () => {
      const debtorQueryResult = makeQueryResults([
        buildDebtor({ ssn: '111-11-1111', taxId: '12-3456789' }),
      ]);
      const aliasQueryResult = makeQueryResults([
        { aliasType: 'name', value: 'John Smith' },
        { aliasType: 'ssn', value: '222-22-2222' },
        { aliasType: 'taxId', value: '98-7654321' },
      ]);

      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeDefined();
      expect(debtor?.additionalIdentifiers?.names).toEqual(['John Smith']);
      expect(debtor?.additionalIdentifiers?.ssns).toEqual(['222-22-2222']);
      expect(debtor?.additionalIdentifiers?.taxIds).toEqual(['98-7654321']);
      expect(debtor?.ssn).toBe('111-11-1111');
      expect(debtor?.taxId).toBe('12-3456789');
    });

    test('should not add additionalIdentifiers property when no additionalIdentifiers exist', async () => {
      const debtorQueryResult = makeQueryResults([buildDebtor()]);
      const aliasQueryResult = makeQueryResults([]);

      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeUndefined();
    });

    test('should handle alias query failure gracefully', async () => {
      const debtorQueryResult = makeQueryResults([buildDebtor()]);
      querySpy.mockResolvedValueOnce(debtorQueryResult);
      querySpy.mockRejectedValueOnce(new Error('Alias query failed'));

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeDefined();
      expect(debtor?.additionalIdentifiers).toBeUndefined();
      expect(debtor?.name).toBe('John Q. Smith');
    });

    test('should work for joint debtor with additionalIdentifiers', async () => {
      const jointDebtorQueryResult = makeQueryResults([buildJointDebtor()]);
      const aliasQueryResult = makeQueryResults([{ aliasType: 'name', value: 'Jane Smith' }]);

      querySpy.mockResolvedValueOnce(jointDebtorQueryResult);
      querySpy.mockResolvedValueOnce(aliasQueryResult);

      const jointDebtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'jd',
      );

      expect(jointDebtor).toBeDefined();
      expect(jointDebtor?.additionalIdentifiers).toBeDefined();
      expect(jointDebtor?.additionalIdentifiers?.names).toEqual(['Jane Smith']);
    });

    test('should return undefined when debtor query returns no results', async () => {
      const debtorQueryResult = makeQueryResults([]);
      querySpy.mockResolvedValueOnce(debtorQueryResult);

      const debtor = await testCasesDxtrGateway.queryDebtorParty(
        applicationContext,
        '12345',
        'NYSB',
        'db',
      );

      expect(debtor).toBeUndefined();
    });
  });
});
