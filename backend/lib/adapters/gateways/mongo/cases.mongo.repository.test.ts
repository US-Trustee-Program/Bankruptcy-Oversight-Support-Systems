import { vi } from 'vitest';
import { CasesSearchPredicate } from '@common/api/search';
import { ResourceActions } from '@common/cams/actions';
import { SyncedCase } from '@common/cams/cases';
import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '@common/cams/events';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsError } from '../../../common-errors/cams-error';
import { closeDeferred } from '../../../deferrable/defer-close';
import QueryBuilder, { Conjunction, using } from '../../../query/query-builder';
import { CASE_HISTORY } from '../../../testing/mock-data/case-history.mock';
import {
  createMockApplicationContext,
  getTheThrownError,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CasesMongoRepository, MATCH_SCORE_THRESHOLD } from './cases.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import * as crypto from 'crypto';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CamsPaginationResponse } from '../../../use-cases/gateways.types';
import { CaseConsolidationHistory, CaseHistory } from '@common/cams/history';
import { randomUUID } from 'crypto';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

/**
 * Helper to test that repository methods properly wrap and re-throw adapter errors.
 *
 * @param adapterMethod - The MongoCollectionAdapter method to mock (e.g., 'find', 'insertOne')
 * @param repoCall - Function that calls the repository method being tested
 * @param expectedMessages - Error messages expected in the camsStack (in order)
 */
async function expectAdapterErrorToBeWrapped(
  adapterMethod: keyof MongoCollectionAdapter<unknown>,
  repoCall: () => Promise<unknown>,
  expectedMessages: string[],
) {
  vi.spyOn(
    MongoCollectionAdapter.prototype,
    adapterMethod as keyof MongoCollectionAdapter<unknown>,
  ).mockRejectedValue(new Error('test error'));

  await expect(repoCall).rejects.toThrow(
    expect.objectContaining({
      message: 'Unknown Error',
      camsStack: expect.arrayContaining(
        expectedMessages.map((message) => ({
          module: expect.anything(),
          message,
        })),
      ),
    }),
  );
}

describe('Cases repository', () => {
  let repo: CasesMongoRepository;
  let context: ApplicationContext;
  const caseId1 = '111-11-11111';
  const caseId2 = '222-22-22222';

  const transferIn: TransferFrom = {
    caseId: caseId2,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId1 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_FROM',
  };

  const transferOut: TransferTo = {
    caseId: caseId1,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId2 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_TO',
  };
  const { and } = QueryBuilder;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = CasesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  afterAll(() => {
    CasesMongoRepository.dropInstance();
  });

  test('should getTransfers', async () => {
    const query: Conjunction<Transfer> = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          leftOperand: { name: 'documentType' },
          rightOperand: '^TRANSFER_',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'caseId' },
          rightOperand: '111-82-80331',
        },
      ],
    };
    const transfers = MockData.buildArray(MockData.getTransferOrder, 5);
    const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(transfers);
    const result = await repo.getTransfers('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(transfers);
  });

  test('getTransfers should catch errors thrown by adapter.find', async () => {
    expect.assertions(1);
    const caseId = '123-12-12345';
    await expectAdapterErrorToBeWrapped('find', () => repo.getTransfers(caseId), [
      `Failed to get transfers for ${caseId}.`,
    ]);
  });

  test('should getConsolidation', async () => {
    const query: Conjunction<ConsolidationTo | ConsolidationFrom> = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          leftOperand: { name: 'documentType' },
          rightOperand: '^CONSOLIDATION_',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'caseId' },
          rightOperand: '111-82-80331',
        },
      ],
    };
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 5);
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(consolidations);
    const result = await repo.getConsolidation('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(consolidations);
  });

  test('should throw error in getConsolidation when find throws', async () => {
    expect.assertions(1);
    const caseId = '111-82-80331';
    await expectAdapterErrorToBeWrapped('find', () => repo.getConsolidation(caseId), [
      `Failed to retrieve consolidation for ${caseId}.`,
    ]);
  });

  test('should getCaseHistory', async () => {
    const query: Conjunction<CaseHistory> = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          leftOperand: { name: 'documentType' },
          rightOperand: '^AUDIT_',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'caseId' },
          rightOperand: '111-82-80331',
        },
      ],
    };
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(CASE_HISTORY);
    const result = await repo.getCaseHistory('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(CASE_HISTORY);
  });

  test('should throw error in getCaseHistory when find throws', async () => {
    expect.assertions(1);
    const caseId = '111-82-80331';
    await expectAdapterErrorToBeWrapped('find', () => repo.getCaseHistory(caseId), [
      `Failed to get case history for ${caseId}.`,
    ]);
  });

  test('createTransferTo should catch errors thrown by adapter.insertOne', async () => {
    expect.assertions(1);
    await expectAdapterErrorToBeWrapped('insertOne', () => repo.createTransferTo(transferOut), [
      'Failed to create item.',
      `Failed to create transferTo for: ${transferOut.caseId}.`,
    ]);
  });

  test('should createTransferTo', async () => {
    const insertOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferTo(transferOut);
    expect(result).not.toBeNull();
    expect(insertOneSpy).toHaveBeenCalledWith(transferOut);
  });

  test('createTransferFrom should catch errors thrown by adapter.insertOne', async () => {
    expect.assertions(1);
    await expectAdapterErrorToBeWrapped('insertOne', () => repo.createTransferFrom(transferIn), [
      'Failed to create item.',
      `Failed to create transferFrom for: ${transferIn.caseId}.`,
    ]);
  });

  test('should createTransferFrom', async () => {
    const insertOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferFrom(transferIn);
    expect(insertOneSpy).toHaveBeenCalledWith(transferIn);
    expect(result).not.toBeNull();
  });

  test('should createConsolidationTo', async () => {
    const consolidationTo = MockData.getConsolidationTo();
    const insertOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationTo(consolidationTo);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationTo);

    expect(result).not.toBeNull();
  });

  test('createConsolidationTo should catch errors thrown by adapter.insertOne', async () => {
    expect.assertions(1);
    const consolidationTo = MockData.getConsolidationTo();
    await expectAdapterErrorToBeWrapped(
      'insertOne',
      () => repo.createConsolidationTo(consolidationTo),
      [
        'Failed to create item.',
        `Failed to create consolidationTo for: ${consolidationTo.caseId}.`,
      ],
    );
  });

  test('should createConsolidationFrom', async () => {
    const consolidationFrom = MockData.getConsolidationFrom();
    const insertOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationFrom(consolidationFrom);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationFrom);
    expect(result).not.toBeNull();
  });

  test('createConsolidationFrom should catch errors thrown by adapter.insertOne', async () => {
    expect.assertions(1);
    const consolidationFrom = MockData.getConsolidationFrom();
    await expectAdapterErrorToBeWrapped(
      'insertOne',
      () => repo.createConsolidationFrom(consolidationFrom),
      [
        'Failed to create item.',
        `Failed to create consolidationFrom for: ${consolidationFrom.caseId}.`,
      ],
    );
  });

  test('should call paginate without caseIds array in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: true,
      limit: 1,
      offset: 0,
    };

    const expectedSyncedCaseArray: CamsPaginationResponse<SyncedCase> = {
      data: [MockData.getSyncedCase({ override: { caseId: caseId1 } })],
    };
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValueOnce(expectedSyncedCaseArray);
    const result = await repo.searchCases(predicate);
    const doc = using<SyncedCase>();

    const expectedQuery = {
      stages: [
        {
          stage: 'MATCH',
          ...and(
            doc('documentType').equals('SYNCED_CASE'),
            doc('chapter').contains(predicate.chapters),
          ),
        },
        {
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        },
        {
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        },
      ],
    };

    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    expect(result).toEqual(expectedSyncedCaseArray);
  });

  test('should call paginate with caseIds array in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: true,
      caseIds: [caseId1, caseId2],
      limit: 25,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      MockData.getSyncedCase({ override: { caseId: caseId2 } }),
    ];
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValue({ data: expectedSyncedCaseArray });
    const result = await repo.searchCases(predicate);
    const doc = using<SyncedCase>();
    const expectedQuery = {
      stages: [
        {
          stage: 'MATCH',
          ...and(
            doc('documentType').equals('SYNCED_CASE'),
            doc('caseId').contains(predicate.caseIds),
            doc('chapter').contains(predicate.chapters),
          ),
        },
        {
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        },
        {
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        },
      ],
    };
    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    expect(result).toEqual({ data: expectedSyncedCaseArray });
  });

  test('should call paginate with caseIds array and excludedCaseIds in query', async () => {
    const excludedCaseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: true,
      caseIds: [caseId1, caseId2],
      excludedCaseIds,
      limit: 5,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      MockData.getSyncedCase({ override: { caseId: caseId2 } }),
    ];
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValue({ data: expectedSyncedCaseArray });
    const result = await repo.searchCases(predicate);
    // TODO: can we find a way to not rely on the exact order here?
    const doc = using<SyncedCase>();

    const expectedQuery = {
      stages: [
        {
          stage: 'MATCH',
          ...and(
            doc('documentType').equals('SYNCED_CASE'),
            doc('caseId').contains(predicate.caseIds),
            doc('chapter').contains(predicate.chapters),
            doc('caseId').notContains(predicate.excludedCaseIds),
          ),
        },
        {
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        },
        {
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        },
      ],
    };

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining(expectedQuery));

    expect(result).toEqual({ data: expectedSyncedCaseArray });
  });

  test('should call paginate with includeOnlyUnassigned in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      includeOnlyUnassigned: true,
      limit: 25,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
    ];

    const expectedPaginationResponse: CamsPaginationResponse<SyncedCase> = {
      metadata: { total: expectedSyncedCaseArray.length },
      data: expectedSyncedCaseArray,
    };

    const aggregateSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValue(expectedPaginationResponse);

    const result = await repo.searchCases(predicate);

    const expectedQuery = {
      stages: [
        expect.objectContaining({ conjunction: 'AND', stage: 'MATCH' }),
        expect.objectContaining({ stage: 'JOIN' }),
        expect.objectContaining({ stage: 'ADD_FIELDS' }),
        expect.objectContaining({ condition: 'EQUALS', stage: 'MATCH' }),
        expect.objectContaining({ stage: 'EXCLUDE' }),
        expect.objectContaining({
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        }),
        expect.objectContaining({
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        }),
      ],
    };

    expect(result).toEqual(expectedPaginationResponse);
    expect(aggregateSpy).toHaveBeenCalledWith(expectedQuery);
  });

  test('should add all conditions', async () => {
    const divisionCodes = ['081', '071'];
    const caseNumber = '00-11111';
    const caseId = divisionCodes[0] + '-' + caseNumber;
    const chapters = ['15', '12'];
    const predicate: CasesSearchPredicate = {
      caseNumber,
      caseIds: [caseId],
      chapters,
      divisionCodes,
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
      includeOnlyUnassigned: true,
      limit: 25,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId } }),
    ];

    const expectedPaginationResponse: CamsPaginationResponse<SyncedCase> = {
      metadata: { total: expectedSyncedCaseArray.length },
      data: expectedSyncedCaseArray,
    };

    const aggregateSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValue(expectedPaginationResponse);

    // This object is very brittle, but I'm not sure if it matters as this is pretty core to the query language.
    const expectedQuery = {
      stages: [
        expect.objectContaining({
          conjunction: 'AND',
          stage: 'MATCH',
          values: expect.arrayContaining([
            expect.objectContaining({
              leftOperand: { name: 'documentType' },
              rightOperand: 'SYNCED_CASE',
            }),
            expect.objectContaining({
              leftOperand: { name: 'caseNumber' },
              rightOperand: caseNumber,
            }),
            expect.objectContaining({
              leftOperand: { name: 'caseId' },
              rightOperand: [caseId],
            }),
            expect.objectContaining({
              leftOperand: { name: 'chapter' },
              rightOperand: chapters,
            }),
            expect.objectContaining({
              leftOperand: { name: 'courtDivisionCode' },
              rightOperand: divisionCodes,
            }),
            expect.objectContaining({
              conjunction: 'OR',
              values: expect.arrayContaining([
                expect.objectContaining({
                  condition: 'EXISTS',
                  leftOperand: { name: 'closedDate' },
                  rightOperand: false,
                }),
                expect.objectContaining({
                  conjunction: 'AND',
                  values: expect.arrayContaining([
                    expect.objectContaining({
                      condition: 'EXISTS',
                      leftOperand: { name: 'reopenedDate' },
                      rightOperand: true,
                    }),
                    expect.objectContaining({
                      condition: 'EXISTS',
                      leftOperand: { name: 'reopenedDate' },
                      rightOperand: true,
                    }),
                    expect.objectContaining({
                      leftOperand: { name: 'reopenedDate' },
                      rightOperand: { name: 'closedDate' },
                    }),
                  ]),
                }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({ stage: 'JOIN' }),
        expect.objectContaining({ stage: 'ADD_FIELDS' }),
        expect.objectContaining({ condition: 'EQUALS', stage: 'MATCH' }),
        expect.objectContaining({ stage: 'EXCLUDE' }),
        expect.objectContaining({
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        }),
        expect.objectContaining({
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        }),
      ],
    };

    const result = await repo.searchCases(predicate);
    expect(result).toEqual(expectedPaginationResponse);
    expect(aggregateSpy).toHaveBeenCalledWith(expectedQuery);
  });

  test('should throw error when paginate throws error', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: false,
      limit: 25,
      offset: 0,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'paginate').mockRejectedValue(
      new CamsError('CASES_MONGO_REPOSITORY'),
    );
    await expect(repo.searchCases(predicate)).rejects.toThrow('Unknown CAMS Error');
  });

  test('should throw error when paginate throws error with includeOnlyUnassigned', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      includeOnlyUnassigned: true,
      limit: 25,
      offset: 0,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'paginate').mockRejectedValue(
      new CamsError('CASES_MONGO_REPOSITORY'),
    );
    await expect(repo.searchCases(predicate)).rejects.toThrow('Unknown CAMS Error');
  });

  test('should call paginate with includeOnlyUnassigned and assignments in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      includeOnlyUnassigned: true,
      assignments: [{ id: '123', name: 'Test User' }],
      limit: 25,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
    ];

    const expectedPaginationResponse: CamsPaginationResponse<SyncedCase> = {
      metadata: { total: expectedSyncedCaseArray.length },
      data: expectedSyncedCaseArray,
    };

    const aggregateSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'paginate')
      .mockResolvedValue(expectedPaginationResponse);

    const result = await repo.searchCases(predicate);

    const expectedQuery = {
      stages: [
        expect.objectContaining({ conjunction: 'AND', stage: 'MATCH' }),
        expect.objectContaining({ stage: 'JOIN' }),
        expect.objectContaining({ stage: 'ADD_FIELDS' }),
        expect.objectContaining({ condition: 'EQUALS', stage: 'MATCH' }),
        expect.objectContaining({ stage: 'EXCLUDE' }),
        expect.objectContaining({
          stage: 'SORT',
          fields: [
            { field: { name: 'dateFiled' }, direction: 'DESCENDING' },
            { field: { name: 'caseNumber' }, direction: 'DESCENDING' },
          ],
        }),
        expect.objectContaining({
          stage: 'PAGINATE',
          skip: predicate.offset,
          limit: predicate.limit,
        }),
      ],
    };

    expect(result).toEqual(expectedPaginationResponse);
    expect(aggregateSpy).toHaveBeenCalledWith(expectedQuery);
  });

  test('should throw error when paginate has invalid limit and offset', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: false,
      limit: 1,
      offset: -1,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      MockData.getSyncedCase({ override: { caseId: caseId2 } }),
    ];
    vi.spyOn(MongoCollectionAdapter.prototype, 'paginate').mockResolvedValue({
      data: expectedSyncedCaseArray,
    });
    await expect(repo.searchCases(predicate)).rejects.toThrow(
      'Case Search requires a pagination predicate with a valid limit and offset',
    );
  });

  describe('searchCases query generation', () => {
    test('should search with caseNumber when provided', async () => {
      const predicate: CasesSearchPredicate = {
        chapters: ['15'],
        caseNumber: '00-00000',
        limit: 25,
        offset: 0,
      };

      const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
        MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      ];

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: expectedSyncedCaseArray });

      const result = await repo.searchCases(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      expect(result.data).toEqual(expectedSyncedCaseArray);

      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);
      expect(queryString).toContain('caseNumber');
    });
  });

  describe('searchCasesWithPhoneticTokens', () => {
    test('should include phoneticTokens matching when debtorName is provided', async () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'John Smith',
        limit: 25,
        offset: 0,
      };

      const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
        MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      ];

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: expectedSyncedCaseArray, metadata: { total: 1 } });

      const result = await repo.searchCasesWithPhoneticTokens(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      expect(result.data).toEqual(expectedSyncedCaseArray);

      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);
      expect(queryString).toContain('debtor.phoneticTokens');
      expect(queryString).toContain('jointDebtor.phoneticTokens');
    });

    test('should apply other filters via addConditions when combined with debtorName', async () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'John',
        chapters: ['15'],
        divisionCodes: ['081'],
        caseNumber: '00-12345',
        limit: 25,
        offset: 0,
      };

      const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
        MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      ];

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: expectedSyncedCaseArray, metadata: { total: 1 } });

      const result = await repo.searchCasesWithPhoneticTokens(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      expect(result.data).toEqual(expectedSyncedCaseArray);

      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);
      expect(queryString).toContain('phoneticTokens');
      expect(queryString).toContain('chapter');
      expect(queryString).toContain('courtDivisionCode');
      expect(queryString).toContain('caseNumber');
    });

    test('should fall back to searchCases when debtorName is not provided', async () => {
      const predicate: CasesSearchPredicate = {
        chapters: ['15'],
        limit: 25,
        offset: 0,
      };

      const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
        MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      ];

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: expectedSyncedCaseArray });

      const result = await repo.searchCasesWithPhoneticTokens(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      expect(result.data).toEqual(expectedSyncedCaseArray);

      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);
      expect(queryString).not.toContain('phoneticTokens');
      expect(queryString).toContain('chapter');
    });

    test('should return empty results when search tokens cannot be generated', async () => {
      const predicate: CasesSearchPredicate = {
        debtorName: '   ',
        limit: 25,
        offset: 0,
      };

      const result = await repo.searchCasesWithPhoneticTokens(predicate);

      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });

    test('should filter results by match score threshold to exclude low-scoring matches', async () => {
      // Searching for "mike" should match "michael" (nickname) but not "smith" (no relation)
      // This test verifies the query includes the match score threshold filter
      const predicate: CasesSearchPredicate = {
        debtorName: 'mike',
        limit: 25,
        offset: 0,
      };

      const michaelCase = MockData.getSyncedCase({
        override: {
          caseId: '111-11-11111',
          debtor: { name: 'Michael Johnson' },
        },
      });

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: [michaelCase], metadata: { total: 1 } });

      const result = await repo.searchCasesWithPhoneticTokens(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      expect(result.data).toEqual([michaelCase]);

      // Verify the query includes the match score threshold filter
      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);

      // Should contain a MATCH stage filtering by matchScore > MATCH_SCORE_THRESHOLD
      expect(queryString).toContain('matchScore');
      expect(queryString).toContain(`"rightOperand":${MATCH_SCORE_THRESHOLD}`);
      expect(queryString).toContain('"condition":"GREATER_THAN"');
    });

    test('should use word-level matching threshold of 0 (any score indicates valid match)', () => {
      // With word-level matching, the algorithm itself prevents false positives.
      // Any score > 0 indicates a valid match (exact, nickname, qualified phonetic, or phonetic prefix).
      // Scores: exact=10000, nickname=1000, qualified phonetic=100, phonetic prefix=75
      expect(MATCH_SCORE_THRESHOLD).toBe(0);
    });

    test('should use word-level matching to prevent false positives instead of bigram filtering', async () => {
      // The new word-level algorithm prevents false positives like "Mike" → "Mitchell" by:
      // 1. Requiring phonetic matches to be "qualified" (have exact, nickname, or prefix match)
      // 2. Matching whole words against nickname database instead of token overlaps
      // This eliminates the need for bigram count filtering.
      const predicate: CasesSearchPredicate = {
        debtorName: 'mike',
        limit: 25,
        offset: 0,
      };

      const paginateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });

      await repo.searchCasesWithPhoneticTokens(predicate);

      expect(paginateSpy).toHaveBeenCalled();
      const actualQuery = paginateSpy.mock.calls[0][0];
      const queryString = JSON.stringify(actualQuery);

      // Should use word-level fields for matching
      expect(queryString).toContain('searchWords');
      expect(queryString).toContain('nicknameWords');
      expect(queryString).toContain('searchMetaphones');
      expect(queryString).toContain('targetNameFields');

      // Should still filter by matchScore > 0
      expect(queryString).toContain('matchScore');
      expect(queryString).toContain('"condition":"GREATER_THAN"');
    });
  });

  test('getConsolidationMemberCaseIds should throw error when find throws error', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: true,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
      new CamsError('CASES_MONGO_REPOSITORY'),
    );
    await expect(repo.getConsolidationMemberCaseIds(predicate)).rejects.toThrow(
      'Unknown CAMS Error',
    );
  });

  test('getConsolidationMemberCaseIds should return a list of caseIds when given full predicate', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      caseIds,
      divisionCodes: ['111'],
      excludeMemberConsolidations: true,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
      MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
      MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
    ]);
    const result = await repo.getConsolidationMemberCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationMemberCaseIds should return a list of caseIds when predicate missing chapters', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      caseIds,
      divisionCodes: ['111'],
      excludeMemberConsolidations: true,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
      MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
      MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
    ]);
    const result = await repo.getConsolidationMemberCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationMemberCaseIds should return a list of caseIds when predicate missing divisionCodes', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      caseIds,
      excludeMemberConsolidations: true,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
      MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
      MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
    ]);
    const result = await repo.getConsolidationMemberCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationMemberCaseIds should return a list of caseIds when missing caseIds', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      divisionCodes: ['111'],
      excludeMemberConsolidations: true,
    };

    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
      MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
      MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
    ]);
    const result = await repo.getConsolidationMemberCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('should persist the case to sync', async () => {
    const bCase = MockData.getSyncedCase();
    const replaceSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue(null);

    const expected: Conjunction<SyncedCase> = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'caseId' },
          rightOperand: bCase.caseId,
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'SYNCED_CASE',
        },
      ],
    };

    await repo.syncDxtrCase(bCase);
    expect(replaceSpy).toHaveBeenCalledWith(expected, bCase, true);
  });

  test('should throw when replaceOne throws error', async () => {
    const bCase = MockData.getSyncedCase();
    vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
      new Error('some error'),
    );

    await expect(repo.syncDxtrCase(bCase)).rejects.toThrow(UnknownError);
  });

  test('should get synced case by caseId', async () => {
    const bCase = MockData.getSyncedCase();
    const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(bCase);

    const actual = await repo.getSyncedCase(bCase.caseId);

    expect(actual).toEqual(bCase);
    expect(findSpy).toHaveBeenCalledWith({
      conjunction: 'AND',
      values: [
        { condition: 'EQUALS', leftOperand: { name: 'caseId' }, rightOperand: bCase.caseId },
        { condition: 'EQUALS', leftOperand: { name: 'documentType' }, rightOperand: 'SYNCED_CASE' },
      ],
    });
  });

  test('should handle error getting synced case', async () => {
    const bCase = MockData.getSyncedCase();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
      new Error('some error'),
    );

    await expect(repo.getSyncedCase(bCase.caseId)).rejects.toThrow(UnknownError);
  });

  test('should call create for case history', async () => {
    const history: CaseConsolidationHistory = {
      id: randomUUID().toString(),
      caseId: '111-11-11111',
      before: null,
      after: {
        status: 'pending',
        memberCases: [],
      },
      documentType: 'AUDIT_CONSOLIDATION',
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
    };
    const createSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(history.id);
    await repo.createCaseHistory(history);
    expect(createSpy).toHaveBeenCalledWith(history);
  });

  test('should handle error creating case history', async () => {
    const history: CaseConsolidationHistory = {
      id: randomUUID().toString(),
      caseId: '111-11-11111',
      before: null,
      after: {
        status: 'pending',
        memberCases: [],
      },
      documentType: 'AUDIT_CONSOLIDATION',
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
    };
    const error = new Error('some error');
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
    const actualError = await getTheThrownError(() => repo.createCaseHistory(history));
    expect(actualError.isCamsError).toBeTruthy();
    expect(actualError.camsStack).toEqual([
      expect.objectContaining({
        message: 'Failed to create item.',
        module: 'CASES-MONGO-REPOSITORY',
      }),
      expect.objectContaining({
        message: expect.stringContaining('Unable to create case history.'),
        module: 'CASES-MONGO-REPOSITORY',
      }),
    ]);
  });
});
