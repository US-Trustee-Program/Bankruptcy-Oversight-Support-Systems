import { vi } from 'vitest';
import CasesDxtrGateway, { parseDxtrDate } from './cases.dxtr.gateway';
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
import { AbstractMssqlClient } from '../abstract-mssql-client';

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
  // debtor and joint debtor parties are fetched in parallel — joint debtor starts before debtor aliases
  querySpy.mockImplementationOnce(async () => mocks.debtorResults);
  querySpy.mockImplementationOnce(async () => mocks.jointDebtorResults);
  if (mocks.debtorAliasResults) {
    querySpy.mockImplementationOnce(async () => mocks.debtorAliasResults);
  }
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

    applicationContext = await createMockApplicationContext();
    applicationContext.config.dxtrDbConfig.database = dxtrDatabaseName;
    testCasesDxtrGateway = new CasesDxtrGateway(applicationContext);

    querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
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
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);
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
      results: { recordset: cases },
      message: '',
    };

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: { recordset: [expectedDebtor] },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: { recordset: [expectedJointDebtor] },
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
    // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);
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
      results: { recordset: cases },
      message: '',
    };

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: { recordset: [expectedDebtor] },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: { recordset: [] },
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
    // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
    // joint debtor additionalIdentifiers (not consumed — empty joint debtor has no alias query)
    querySpy.mockResolvedValueOnce(mockDebtorTypeTransactionResults);
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
      { txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz', txCode: 'CBC' },
      { txRecord: 'zzzzzzzzzzzzzzzzzzz231115zzzzzzzzzzzz', txCode: 'CDC' },
    ];

    const mockCaseResults: QueryResults = {
      success: true,
      results: { recordset: cases },
      message: '',
    };

    const mockTransactionResults: QueryResults = {
      success: true,
      results: { recordset: transactions },
      message: '',
    };

    const mockQueryDebtor: QueryResults = {
      success: true,
      results: { recordset: [expectedDebtor] },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: { recordset: [expectedJointDebtor] },
      message: '',
    };

    const mockQueryTrustee: QueryResults = {
      success: true,
      results: { recordset: [expectedTrusteeRecord] },
      message: '',
    };

    const mockQueryDebtorAttorney: QueryResults = {
      success: true,
      results: { recordset: [expectedDebtorAttorney] },
      message: '',
    };

    const mockQueryJointDebtorAttorney: QueryResults = {
      success: true,
      results: { recordset: [expectedJointDebtorAttorney] },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);
    // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
    querySpy.mockResolvedValueOnce(mockQueryDebtor);
    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
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
      results: { recordset: cases },
      message: '',
    };

    const transactions = [
      { txRecord: 'zzzzzzzzzzzzzzzzzzz230830zzzzzzzzzzzz', txCode: 'CBC' },
      { txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz', txCode: 'CBC' },
      { txRecord: 'zzzzzzzzzzzzzzzzzzz231031zzzzzzzzzzzz', txCode: 'CDC' },
    ];

    const mockTransactionResults: QueryResults = {
      success: true,
      results: { recordset: transactions },
      message: '',
    };

    const mockQueryParties: QueryResults = {
      success: true,
      results: { recordset: [{ partyName: 'John Q. Smith' }] },
      message: '',
    };

    const mockQueryJointDebtor: QueryResults = {
      success: true,
      results: { recordset: [{ partyName: 'Jane Q. Smith' }] },
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
      results: { recordset: [expectedTrusteeRecord] },
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
      results: { recordset: [expectedDebtorAttorney] },
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
      results: { recordset: [expectedJointDebtorAttorney] },
      message: '',
    };

    querySpy.mockResolvedValueOnce(mockCaseResults);
    // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
    querySpy.mockResolvedValueOnce(mockQueryParties);
    querySpy.mockResolvedValueOnce(mockQueryJointDebtor);
    // debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
    // joint debtor additionalIdentifiers
    querySpy.mockResolvedValueOnce(makeQueryResults([]));
    querySpy.mockResolvedValueOnce(mockTransactionResults);
    querySpy.mockResolvedValueOnce(mockQueryTrustee);
    querySpy.mockResolvedValueOnce(mockQueryDebtorAttorney);
    querySpy.mockResolvedValueOnce(mockQueryJointDebtorAttorney);

    await testCasesDxtrGateway.getCaseDetail(applicationContext, '081-23-12345');
    // getCase — args: (context, query, input) → index 2 is input
    expect(querySpy.mock.calls[0][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrCaseId', value: '23-12345' }),
        expect.objectContaining({ name: 'courtDiv', value: '081' }),
      ]),
    );
    // getDebtors
    expect(querySpy.mock.calls[1][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtorAliases
    expect(querySpy.mock.calls[2][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtors
    expect(querySpy.mock.calls[3][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtorAliases
    expect(querySpy.mock.calls[4][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getTransactions
    expect(querySpy.mock.calls[5][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getTrustee
    expect(querySpy.mock.calls[6][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getDebtorAttorneys
    expect(querySpy.mock.calls[7][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
    // getJointDebtorAttorneys
    expect(querySpy.mock.calls[8][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dxtrId', value: testCase.dxtrId }),
        expect.objectContaining({ name: 'courtId', value: testCase.courtId }),
      ]),
    );
  });

  describe('getCaseDetail — name and address whitespace collapsing', () => {
    test('should collapse extra whitespace in debtor name, attorney name, and cityStateZipCountry', async () => {
      const messyDebtor = buildDebtor({
        name: 'John   Q.   Smith',
        cityStateZipCountry: 'Queens NY     12345 USA',
      });
      const messyAttorney = buildAttorney({
        name: 'James   Brown   Esq.',
        cityStateZipCountry: 'Queens NY     12345 USA',
      });
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });

      setupCaseDetailQuerySequence(querySpy, {
        caseResults: makeQueryResults([testCase]),
        debtorResults: makeQueryResults([messyDebtor]),
        debtorAliasResults: makeQueryResults([]),
        jointDebtorResults: makeQueryResults([]),
        transactionResults: makeQueryResults([]),
        trusteeResults: makeQueryResults([
          { name: 'Robert   Trustee', cityStateZipCountry: 'NY   10001' },
        ]),
        debtorAttorneyResults: makeQueryResults([messyAttorney]),
        jointDebtorAttorneyResults: makeQueryResults([]),
      });

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.debtor.name).toEqual('John Q. Smith');
      expect(result.debtor.cityStateZipCountry).toEqual('Queens NY 12345 USA');
      expect(result.debtorAttorney.name).toEqual('James Brown Esq.');
      expect(result.debtorAttorney.cityStateZipCountry).toEqual('Queens NY 12345 USA');
      expect(result.trustee.name).toEqual('Robert Trustee');
      expect(result.trustee.legacy.cityStateZipCountry).toEqual('NY 10001');
    });
  });

  describe('getSuggestedCases tests', () => {
    test('should return decorated transferred cases', async () => {
      const testCase = MockData.getCaseSummary();
      const mockTestCaseSummaryResponse = {
        success: true,
        results: { recordset: [testCase] },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      const mockParties = {
        success: true,
        results: { recordset: [DEBTORS.get('081-22-23587')] },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockParties);

      const mockJointDebtor = {
        success: true,
        results: { recordset: [{ partyName: 'Jane Q. Smith' }] },
        message: '',
      };
      // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
      querySpy.mockResolvedValueOnce(mockJointDebtor);
      // debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));
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
        results: { recordset: mockSuggestedCases },
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
      const testCase = MockData.getCaseDetail();
      const mockTestCaseSummaryResponse = {
        success: true,
        results: { recordset: [testCase] },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockTestCaseSummaryResponse);

      const mockParties = {
        success: true,
        results: { recordset: [DEBTORS.get('081-22-23587')] },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockParties);

      const mockJointDebtor = {
        success: true,
        results: { recordset: [{ partyName: 'Jane Q. Smith' }] },
        message: '',
      };
      // debtor and joint debtor fetched in parallel — joint debtor starts before debtor aliases
      querySpy.mockResolvedValueOnce(mockJointDebtor);
      // debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));
      // joint debtor additionalIdentifiers
      querySpy.mockResolvedValueOnce(makeQueryResults([]));

      const mockSuggestedCasesResponse = {
        success: false,
        results: { recordset: [] },
        message: '',
      };
      querySpy.mockResolvedValueOnce(mockSuggestedCasesResponse);

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
      results: { recordset: [testCase] },
      message: '',
    };
    const partyQueryResult = {
      success: true,
      results: { recordset: [testParty] },
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
      querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
      const mockTestCaseSummaryResponse = {
        success: true,
        results: { recordset: [] },
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
        expect.stringContaining("cs.CS_CHAPTER IN ('15')"),
        expect.anything(),
      );
    });

    test('should use table-qualified cs.CS_CASEID when dxtrId predicate is supplied', async () => {
      await testCasesDxtrGateway.searchCases(applicationContext, {
        dxtrId: testCase.dxtrId,
        courtId: testCase.courtId,
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('cs.CS_CASEID = @dxtrId'),
        expect.anything(),
      );
    });

    test('should use table-qualified cs.COURT_ID when courtId predicate is supplied', async () => {
      await testCasesDxtrGateway.searchCases(applicationContext, {
        dxtrId: testCase.dxtrId,
        courtId: testCase.courtId,
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('cs.COURT_ID = @courtId'),
        expect.anything(),
      );
    });

    test('should return an error', async () => {
      vi.resetAllMocks();
      querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
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

    test.each([
      {
        description: 'should add CS_CASEID condition when dxtrId provided',
        searchParams: { dxtrId: '12345' },
        expectedInQuery: ['CS_CASEID = @dxtrId'],
        expectedParams: [{ name: 'dxtrId', value: '12345' }],
      },
      {
        description: 'should add COURT_ID condition when courtId provided',
        searchParams: { courtId: 'ABC' },
        expectedInQuery: ['COURT_ID = @courtId'],
        expectedParams: [{ name: 'courtId', value: 'ABC' }],
      },
      {
        description: 'should use both dxtrId and courtId together (composite key query)',
        searchParams: { dxtrId: '12345', courtId: 'ABC' },
        expectedInQuery: ['CS_CASEID = @dxtrId', 'COURT_ID = @courtId'],
        expectedParams: [
          { name: 'dxtrId', value: '12345' },
          { name: 'courtId', value: 'ABC' },
        ],
      },
      {
        description: 'should work with dxtrId/courtId and caseNumber together',
        searchParams: { dxtrId: '12345', courtId: 'ABC', caseNumber: '00-00000' },
        expectedInQuery: [
          'CS_CASEID = @dxtrId',
          'COURT_ID = @courtId',
          "cs.CASE_ID LIKE @caseNumber+'%'",
        ],
        expectedParams: [
          { name: 'dxtrId', value: '12345' },
          { name: 'courtId', value: 'ABC' },
        ],
      },
      {
        description: 'should work with dxtrId/courtId and divisionCodes together',
        searchParams: { dxtrId: '12345', courtId: 'ABC', divisionCodes: ['999'] },
        expectedInQuery: [
          'CS_CASEID = @dxtrId',
          'COURT_ID = @courtId',
          'cs_div.CS_DIV_ACMS IN (@divisionCode0)',
        ],
        expectedParams: [
          { name: 'dxtrId', value: '12345' },
          { name: 'courtId', value: 'ABC' },
        ],
      },
      {
        description: 'should work with dxtrId/courtId and chapters together',
        searchParams: { dxtrId: '12345', courtId: 'ABC', chapters: ['15'] },
        expectedInQuery: ['CS_CASEID = @dxtrId', 'COURT_ID = @courtId', "cs.CS_CHAPTER IN ('15')"],
        expectedParams: [
          { name: 'dxtrId', value: '12345' },
          { name: 'courtId', value: 'ABC' },
        ],
      },
    ])('$description', async ({ searchParams, expectedInQuery, expectedParams }) => {
      await testCasesDxtrGateway.searchCases(applicationContext, searchParams);

      const callArgs = querySpy.mock.calls[0];
      const query = callArgs[1] as string;
      const params = callArgs[2] as DbTableFieldSpec[];

      expectedInQuery.forEach((expectedString) => {
        expect(query).toContain(expectedString);
      });

      expectedParams.forEach(({ name, value }) => {
        const param = params.find((p) => p.name === name);
        expect(param).toBeDefined();
        expect(param?.value).toBe(value);
      });
    });

    test.each([
      {
        description: 'regression: should work with caseNumber only',
        searchParams: { caseNumber: '00-00000' },
        expectedInQuery: "cs.CASE_ID LIKE @caseNumber+'%'",
        expectedResult: [testCase],
      },
      {
        description: 'regression: should work with divisionCodes only',
        searchParams: { divisionCodes: ['999'] },
        expectedInQuery: 'cs_div.CS_DIV_ACMS IN (@divisionCode0)',
        expectedResult: [testCase],
      },
    ])('$description', async ({ searchParams, expectedInQuery, expectedResult }) => {
      const actual = await testCasesDxtrGateway.searchCases(applicationContext, searchParams);

      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(expectedInQuery),
        expect.anything(),
      );
      expect(actual).toEqual(expectedResult);
    });
  });

  describe('findTransactionIdRangeForDate', () => {
    const dateRangeMock = (_context, query: string, params: DbTableFieldSpec[]) => {
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
        results: { recordset },
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

      const casesRecordset = MockData.buildArray(MockData.randomCaseId, 50).map((caseId, idx) => {
        const syncDate = idx === 0 ? latestCasesSyncDate : '2025-02-10T08:00:00.000Z';
        return { caseId, latestSyncDate: syncDate };
      });

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

      const allCaseIds = new Set([
        ...casesRecordset.map((r) => r.caseId),
        ...transactionsRecordset.map((r) => r.caseId),
      ]);

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
        results: { recordset: [] },
        message: '',
      };

      const casesStart = '2025-02-11T08:00:00.000Z';
      const transactionsStart = '2025-02-11T09:00:00.000Z';

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

    test.each([
      {
        description: 'should return cases updated via LAST_UPDATE_DATE (from AO_CS)',
        casesData: [
          { caseId: '081-20-10508', latestSyncDate: '2025-02-11T10:00:00.000Z' },
          { caseId: '081-21-12345', latestSyncDate: '2025-02-11T09:00:00.000Z' },
        ],
        transactionsData: [],
        expectedCaseIds: ['081-20-10508', '081-21-12345'],
        expectedLatestCasesSyncDate: '2025-02-11T10:00:00.000Z',
        expectedLatestTransactionsSyncDate: '2024-01-01',
      },
      {
        description: 'should include cases with terminal transactions from AO_TX',
        casesData: [],
        transactionsData: [{ caseId: '081-20-10508', latestSyncDate: '2025-02-11T14:00:00.000Z' }],
        expectedCaseIds: ['081-20-10508'],
        expectedLatestCasesSyncDate: '2024-01-01',
        expectedLatestTransactionsSyncDate: '2025-02-11T14:00:00.000Z',
      },
      {
        description: 'should deduplicate cases found in both AO_CS and AO_TX queries',
        casesData: [{ caseId: '081-20-10508', latestSyncDate: '2025-02-11T10:00:00.000Z' }],
        transactionsData: [{ caseId: '081-20-10508', latestSyncDate: '2025-02-11T14:00:00.000Z' }],
        expectedCaseIds: ['081-20-10508'],
        expectedLatestCasesSyncDate: '2025-02-11T10:00:00.000Z',
        expectedLatestTransactionsSyncDate: '2025-02-11T14:00:00.000Z',
      },
      {
        description: 'should return cases from both AO_CS and AO_TX queries',
        casesData: [{ caseId: '081-20-10508', latestSyncDate: '2025-02-11T10:00:00.000Z' }],
        transactionsData: [{ caseId: '081-21-12345', latestSyncDate: '2025-02-11T14:00:00.000Z' }],
        expectedCaseIds: ['081-20-10508', '081-21-12345'],
        expectedLatestCasesSyncDate: '2025-02-11T10:00:00.000Z',
        expectedLatestTransactionsSyncDate: '2025-02-11T14:00:00.000Z',
      },
    ])(
      '$description',
      async ({
        casesData,
        transactionsData,
        expectedCaseIds,
        expectedLatestCasesSyncDate,
        expectedLatestTransactionsSyncDate,
      }) => {
        const casesResults = makeQueryResults(casesData);
        const transactionsResults = makeQueryResults(transactionsData);

        querySpy.mockResolvedValueOnce(casesResults);
        querySpy.mockResolvedValueOnce(transactionsResults);

        const result = await testCasesDxtrGateway.getUpdatedCaseIds(
          applicationContext,
          '2024-01-01',
          '2024-01-01',
        );

        expectedCaseIds.forEach((caseId) => {
          expect(result.caseIds).toContain(caseId);
        });

        expect(result.latestCasesSyncDate).toEqual(expectedLatestCasesSyncDate);
        expect(result.latestTransactionsSyncDate).toEqual(expectedLatestTransactionsSyncDate);
      },
    );
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

      const query = querySpy.mock.calls[0][1];
      expect(query).toContain("TX.TX_CODE IN ('CBC', 'CDC', 'OCO', 'CTO')");
    });

    test('should filter by TX_TYPE = O', async () => {
      querySpy.mockResolvedValue(makeQueryResults([]));

      await testCasesDxtrGateway.getCasesWithTerminalTransactionBlindSpot(
        applicationContext,
        '2018-01-01',
      );

      const query = querySpy.mock.calls[0][1];
      expect(query).toContain("TX.TX_TYPE = 'O'");
    });
  });

  describe('getCaseDetail — additionalIdentifiers', () => {
    // Helper: build the full getCaseDetail mock sequence with custom debtor/joint debtor alias data
    function setupWithAliases(
      testCase,
      debtorAliases: object[],
      jointDebtorAliases: object[] = [],
      debtorOverrides = {},
    ) {
      setupCaseDetailQuerySequence(querySpy, {
        caseResults: makeQueryResults([testCase]),
        debtorResults: makeQueryResults([buildDebtor(debtorOverrides)]),
        debtorAliasResults: makeQueryResults(debtorAliases),
        jointDebtorResults: makeQueryResults([buildJointDebtor()]),
        jointDebtorAliasResults: makeQueryResults(jointDebtorAliases),
        transactionResults: makeQueryResults([]),
        trusteeResults: makeQueryResults([]),
        debtorAttorneyResults: makeQueryResults([]),
        jointDebtorAttorneyResults: makeQueryResults([]),
      });
    }

    test('should attach deduplicated, sorted additionalIdentifiers with whitespace-collapsed names to debtor', async () => {
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });
      setupWithAliases(testCase, [
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

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.debtor.additionalIdentifiers.names).toEqual([
        'Adam Brown',
        'John Q. Smith',
        'Michael J Smith',
        'Zachary Smith',
      ]);
      expect(result.debtor.additionalIdentifiers.ssns).toEqual(['111-11-1111', '222-22-2222']);
      expect(result.debtor.additionalIdentifiers.taxIds).toEqual(['12-3456789', '98-7654321']);
    });

    test('should filter empty and whitespace-only alias values', async () => {
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });
      setupWithAliases(testCase, [
        { aliasType: 'name', value: 'John Smith' },
        { aliasType: 'name', value: '   ' },
        { aliasType: 'name', value: 'Jane Doe' },
        { aliasType: 'name', value: '' },
        { aliasType: 'ssn', value: '111-11-1111' },
        { aliasType: 'ssn', value: '' },
        { aliasType: 'taxId', value: '12-3456789' },
      ]);

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.debtor.additionalIdentifiers.names).toEqual(['Jane Doe', 'John Smith']);
      expect(result.debtor.additionalIdentifiers.ssns).toEqual(['111-11-1111']);
      expect(result.debtor.additionalIdentifiers.taxIds).toEqual(['12-3456789']);
    });

    test('should not attach additionalIdentifiers when aliases are empty', async () => {
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });
      setupWithAliases(testCase, []);

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.debtor.additionalIdentifiers).toBeUndefined();
    });

    test('should return debtor without additionalIdentifiers when alias query fails', async () => {
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });
      const logSpy = vi.spyOn(applicationContext.logger, 'warn');

      // Case query
      querySpy.mockResolvedValueOnce(makeQueryResults([testCase]));
      // Debtor party (parallel with jd)
      querySpy.mockResolvedValueOnce(makeQueryResults([buildDebtor()]));
      // Joint debtor party
      querySpy.mockResolvedValueOnce(makeQueryResults([buildJointDebtor()]));
      // Debtor alias query fails
      querySpy.mockRejectedValueOnce(new Error('Alias query failed'));
      // Joint debtor alias query
      querySpy.mockResolvedValueOnce(makeQueryResults([]));
      // Remaining queries
      querySpy.mockResolvedValue(makeQueryResults([]));

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.debtor).toBeDefined();
      expect(result.debtor.additionalIdentifiers).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        'CASES-DXTR-GATEWAY',
        "Failed to query party's additional identifiers",
        expect.any(Error),
      );
    });

    test.each([
      {
        description: 'should attach name aliases',
        aliasData: [
          { aliasType: 'name', value: 'Michael J Smith' },
          { aliasType: 'name', value: 'John Smith' },
        ],
        debtorOverrides: {},
        expectedIdentifiers: { names: ['John Smith', 'Michael J Smith'], ssns: [], taxIds: [] },
        expectedSsn: '123-45-6789',
        expectedTaxId: '12-3456789',
      },
      {
        description: 'should attach SSN aliases',
        aliasData: [
          { aliasType: 'ssn', value: '222-22-2222' },
          { aliasType: 'ssn', value: '333-33-3333' },
        ],
        debtorOverrides: { ssn: '111-11-1111' },
        expectedIdentifiers: { names: [], ssns: ['222-22-2222', '333-33-3333'], taxIds: [] },
        expectedSsn: '111-11-1111',
        expectedTaxId: '12-3456789',
      },
      {
        description: 'should attach taxId aliases',
        aliasData: [
          { aliasType: 'taxId', value: '98-7654321' },
          { aliasType: 'taxId', value: '11-1111111' },
        ],
        debtorOverrides: { taxId: '12-3456789' },
        expectedIdentifiers: { names: [], ssns: [], taxIds: ['11-1111111', '98-7654321'] },
        expectedSsn: '123-45-6789',
        expectedTaxId: '12-3456789',
      },
      {
        description: 'should attach all three alias types together',
        aliasData: [
          { aliasType: 'name', value: 'John Smith' },
          { aliasType: 'ssn', value: '222-22-2222' },
          { aliasType: 'taxId', value: '98-7654321' },
        ],
        debtorOverrides: { ssn: '111-11-1111', taxId: '12-3456789' },
        expectedIdentifiers: {
          names: ['John Smith'],
          ssns: ['222-22-2222'],
          taxIds: ['98-7654321'],
        },
        expectedSsn: '111-11-1111',
        expectedTaxId: '12-3456789',
      },
    ])(
      '$description',
      async ({ aliasData, debtorOverrides, expectedIdentifiers, expectedSsn, expectedTaxId }) => {
        const testCase = MockData.getCaseDetail({
          override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
        });
        setupWithAliases(testCase, aliasData, [], debtorOverrides);

        const result = await testCasesDxtrGateway.getCaseDetail(
          applicationContext,
          testCase.caseId,
        );

        expect(result.debtor.additionalIdentifiers).toBeDefined();
        expect(result.debtor.additionalIdentifiers.names).toEqual(expectedIdentifiers.names);
        expect(result.debtor.additionalIdentifiers.ssns).toEqual(expectedIdentifiers.ssns);
        expect(result.debtor.additionalIdentifiers.taxIds).toEqual(expectedIdentifiers.taxIds);
        expect(result.debtor.ssn).toBe(expectedSsn);
        expect(result.debtor.taxId).toBe(expectedTaxId);
      },
    );

    test('should attach additionalIdentifiers to joint debtor when joint debtor aliases exist', async () => {
      const testCase = MockData.getCaseDetail({
        override: { trustee: MockData.getLegacyTrustee({ name: 'placeholder' }) },
      });
      setupWithAliases(testCase, [], [{ aliasType: 'name', value: 'Jane Smith' }]);

      const result = await testCasesDxtrGateway.getCaseDetail(applicationContext, testCase.caseId);

      expect(result.jointDebtor?.additionalIdentifiers).toBeDefined();
      expect(result.jointDebtor?.additionalIdentifiers?.names).toEqual(['Jane Smith']);
    });
  });
});

describe('getAppointmentDatesByCaseIds', () => {
  let querySpy: ReturnType<typeof vi.spyOn>;
  let applicationContext: Awaited<ReturnType<typeof createMockApplicationContext>>;
  let gateway: CasesDxtrGateway;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    gateway = new CasesDxtrGateway(applicationContext);
    querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns empty map when caseIds is empty', async () => {
    const result = await gateway.getAppointmentDatesByCaseIds(applicationContext, []);
    expect(result).toEqual(new Map());
    expect(querySpy).not.toHaveBeenCalled();
  });

  test('returns map of caseId to ISO appointed date', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: {
        recordset: [
          { caseId: '081-24-12345', aptDate: '260407' },
          { caseId: '082-24-67890', aptDate: '250115' },
        ],
      },
      message: '',
    } as QueryResults);

    const result = await gateway.getAppointmentDatesByCaseIds(applicationContext, [
      '081-24-12345',
      '082-24-67890',
    ]);

    expect(result.get('081-24-12345')).toBe('2026-04-07');
    expect(result.get('082-24-67890')).toBe('2025-01-15');
  });

  test('deduplicates rows — keeps most recent (first) row per caseId', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: {
        recordset: [
          { caseId: '081-24-12345', aptDate: '260407' },
          { caseId: '081-24-12345', aptDate: '250101' },
        ],
      },
      message: '',
    } as QueryResults);

    const result = await gateway.getAppointmentDatesByCaseIds(applicationContext, ['081-24-12345']);

    expect(result.get('081-24-12345')).toBe('2026-04-07');
    expect(result.size).toBe(1);
  });

  test('excludes entries where aptDate is sentinel 000000', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: {
        recordset: [{ caseId: '081-24-12345', aptDate: '000000' }],
      },
      message: '',
    } as QueryResults);

    const result = await gateway.getAppointmentDatesByCaseIds(applicationContext, ['081-24-12345']);

    expect(result.size).toBe(0);
  });

  test('returns empty map when no records returned from DXTR', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: { recordset: [] },
      message: '',
    } as QueryResults);

    const result = await gateway.getAppointmentDatesByCaseIds(applicationContext, ['081-24-12345']);

    expect(result.size).toBe(0);
  });
});

describe('getTrusteeAppointments', () => {
  let querySpy: ReturnType<typeof vi.spyOn>;
  let applicationContext: Awaited<ReturnType<typeof createMockApplicationContext>>;
  let gateway: CasesDxtrGateway;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    gateway = new CasesDxtrGateway(applicationContext);
    querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: { recordset: [] },
      message: '',
    } as QueryResults);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('overrides the pool default requestTimeout with the trustee appointments timeout', async () => {
    await gateway.getTrusteeAppointments(applicationContext, '2018-01-01T00:00:00.000Z');

    expect(querySpy).toHaveBeenCalledWith(
      applicationContext,
      expect.any(String),
      expect.any(Array),
      600000,
    );
  });
});

describe('parseDxtrDate', () => {
  test('converts YYMMDD string to ISO date', () => {
    expect(parseDxtrDate('260407')).toBe('2026-04-07');
  });

  test('returns undefined for undefined input', () => {
    expect(parseDxtrDate(undefined)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseDxtrDate('')).toBeUndefined();
  });

  test('returns undefined for all-zeros sentinel', () => {
    expect(parseDxtrDate('000000')).toBeUndefined();
  });

  test('returns undefined for whitespace-only string', () => {
    expect(parseDxtrDate('   ')).toBeUndefined();
  });

  test('trims whitespace before parsing', () => {
    expect(parseDxtrDate(' 260407 ')).toBe('2026-04-07');
  });

  test('returns undefined for string shorter than 6 characters', () => {
    expect(parseDxtrDate('2604')).toBeUndefined();
  });

  test('returns undefined for string longer than 6 characters', () => {
    expect(parseDxtrDate('2604071')).toBeUndefined();
  });

  test('returns undefined for non-numeric string', () => {
    expect(parseDxtrDate('26040X')).toBeUndefined();
  });

  test('returns undefined for invalid month (> 12)', () => {
    expect(parseDxtrDate('261399')).toBeUndefined();
  });

  test('returns undefined for invalid month (00)', () => {
    expect(parseDxtrDate('260001')).toBeUndefined();
  });

  test('returns undefined for invalid day (> 31)', () => {
    expect(parseDxtrDate('260432')).toBeUndefined();
  });

  test('returns undefined for invalid day (00)', () => {
    expect(parseDxtrDate('260400')).toBeUndefined();
  });
});
