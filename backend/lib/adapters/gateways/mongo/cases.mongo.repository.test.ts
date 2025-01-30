import { CasesSearchPredicate } from '../../../../../common/src/api/search';
import { ResourceActions } from '../../../../../common/src/cams/actions';
import { SyncedCase } from '../../../../../common/src/cams/cases';
import { TransferFrom, TransferTo } from '../../../../../common/src/cams/events';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { CamsError } from '../../../common-errors/cams-error';
import { closeDeferred } from '../../../deferrable/defer-close';
import QueryBuilder from '../../../query/query-builder';
import { CASE_HISTORY } from '../../../testing/mock-data/case-history.mock';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CasesMongoRepository } from './cases.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import * as crypto from 'crypto';
import { UnknownError } from '../../../common-errors/unknown-error';

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
  const { and, equals, contains, notContains } = QueryBuilder;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = CasesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repo.release();
  });

  test('should getTransfers', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^TRANSFER_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const transfers = MockData.buildArray(MockData.getTransferOrder, 5);
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(transfers);
    const result = await repo.getTransfers('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(transfers);
  });

  test('getTransfers should catch errors thrown by adapter.find', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    const caseId = '123-12-12345';
    await expect(async () => await repo.getTransfers(caseId)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: `Failed to get transfers for ${caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should getConsolidation', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^CONSOLIDATION_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 5);
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(consolidations);
    const result = await repo.getConsolidation('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(consolidations);
  });

  test('should throw error in getConsolidation when find throws', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    const caseId = '111-82-80331';
    await expect(async () => await repo.getConsolidation(caseId)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: `Failed to retrieve consolidation for ${caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should getCaseHistory', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^AUDIT_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(CASE_HISTORY);
    const result = await repo.getCaseHistory('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(CASE_HISTORY);
  });

  test('should throw error in getCaseHistory when find throws', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    const caseId = '111-82-80331';
    await expect(async () => await repo.getCaseHistory(caseId)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: `Failed to get case history for ${caseId}.`,
          },
        ]),
      }),
    );
  });

  test('createTransferTo should catch errors thrown by adapter.insertOne', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockRejectedValue(new Error('test error'));
    await expect(async () => await repo.createTransferTo(transferOut)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: 'Failed to create item.',
          },
          {
            module: expect.anything(),
            message: `Failed to create transferTo for: ${transferOut.caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should createTransferTo', async () => {
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferTo(transferOut);
    expect(result).not.toBeNull();
    expect(insertOneSpy).toHaveBeenCalledWith(transferOut);
  });

  test('createTransferFrom should catch errors thrown by adapter.insertOne', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockRejectedValue(new Error('test error'));
    await expect(async () => await repo.createTransferFrom(transferIn)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: 'Failed to create item.',
          },
          {
            module: expect.anything(),
            message: `Failed to create transferFrom for: ${transferIn.caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should createTransferFrom', async () => {
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferFrom(transferIn);
    expect(insertOneSpy).toHaveBeenCalledWith(transferIn);
    expect(result).not.toBeNull();
  });

  test('should createConsolidationTo', async () => {
    const consolidationTo = MockData.getConsolidationTo();
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationTo(consolidationTo);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationTo);

    expect(result).not.toBeNull();
  });

  test('createConsolidationTo should catch errors thrown by adapter.insertOne', async () => {
    const consolidaitonTo = MockData.getConsolidationTo();
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockRejectedValue(new Error('test error'));
    await expect(async () => await repo.createConsolidationTo(consolidaitonTo)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: 'Failed to create item.',
          },
          {
            module: expect.anything(),
            message: `Failed to create consolidationTo for: ${consolidaitonTo.caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should createConsolidationFrom', async () => {
    const consolidationFrom = MockData.getConsolidationFrom();
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationFrom(consolidationFrom);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationFrom);
    expect(result).not.toBeNull();
  });

  test('createConsolidationFrom should catch errors thrown by adapter.insertOne', async () => {
    const consolidationFrom = MockData.getConsolidationFrom();

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockRejectedValue(new Error('test error'));
    await expect(async () => await repo.createConsolidationFrom(consolidationFrom)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        camsStack: expect.arrayContaining([
          {
            module: expect.anything(),
            message: 'Failed to create item.',
          },
          {
            module: expect.anything(),
            message: `Failed to create consolidationFrom for: ${consolidationFrom.caseId}.`,
          },
        ]),
      }),
    );
  });

  test('should searchCases should be called without caseIds array in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeChildConsolidations: true,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
    ];
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValueOnce(expectedSyncedCaseArray);
    const result = await repo.searchCases(predicate);
    const expectedQuery = QueryBuilder.build(
      and(equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE')),
    );
    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    expect(result).toEqual(expectedSyncedCaseArray);
  });

  test('should searchCases should be called with caseIds array in query', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeChildConsolidations: true,
      caseIds: [caseId1, caseId2],
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      MockData.getSyncedCase({ override: { caseId: caseId2 } }),
    ];
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(expectedSyncedCaseArray);
    const result = await repo.searchCases(predicate);
    const expectedQuery = QueryBuilder.build(
      and(
        equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'),
        contains<string[]>('caseId', predicate.caseIds),
      ),
    );
    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    expect(result).toEqual(expectedSyncedCaseArray);
  });

  test('should searchCases should be called with caseIds array and excludedCaseIds in query', async () => {
    const excludedCaseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeChildConsolidations: true,
      caseIds: [caseId1, caseId2],
      excludedCaseIds,
      limit: 5,
      offset: 0,
    };

    const expectedSyncedCaseArray: ResourceActions<SyncedCase>[] = [
      MockData.getSyncedCase({ override: { caseId: caseId1 } }),
      MockData.getSyncedCase({ override: { caseId: caseId2 } }),
    ];
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(expectedSyncedCaseArray);
    const result = await repo.searchCases(predicate);
    const expectedQuery = QueryBuilder.build(
      and(
        equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'),
        contains<string[]>('caseId', predicate.caseIds),
        notContains<string[]>('caseId', predicate.excludedCaseIds),
      ),
    );
    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    expect(result).toEqual(expectedSyncedCaseArray);
  });

  test('searchCases should throw error when find throws error', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeChildConsolidations: false,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockRejectedValue(new CamsError('CASES_MONGO_REPOSITORY'));
    await expect(async () => await repo.searchCases(predicate)).rejects.toThrow(
      'Unknown CAMS Error',
    );
  });

  test('getConsolidationChildCaseIds should throw error when find throws error', async () => {
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeChildConsolidations: true,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockRejectedValue(new CamsError('CASES_MONGO_REPOSITORY'));
    await expect(async () => await repo.getConsolidationChildCaseIds(predicate)).rejects.toThrow(
      'Unknown CAMS Error',
    );
  });

  test('getConsolidationChildCaseIds should return a list of caseIds when given full predicate', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      caseIds,
      divisionCodes: ['111'],
      excludeChildConsolidations: true,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([
        MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
        MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
      ]);
    const result = await repo.getConsolidationChildCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationChildCaseIds should return a list of caseIds when predicate missing chapters', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      caseIds,
      divisionCodes: ['111'],
      excludeChildConsolidations: true,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([
        MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
        MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
      ]);
    const result = await repo.getConsolidationChildCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationChildCaseIds should return a list of caseIds when predicate missing divisionCodes', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      caseIds,
      excludeChildConsolidations: true,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([
        MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
        MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
      ]);
    const result = await repo.getConsolidationChildCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('getConsolidationChildCaseIds should return a list of caseIds when missing caseIds', async () => {
    const caseIds = ['111-11-11111', '111-11-11112'];
    const predicate: CasesSearchPredicate = {
      chapters: ['15'],
      divisionCodes: ['111'],
      excludeChildConsolidations: true,
    };

    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([
        MockData.getSyncedCase({ override: { caseId: caseIds[0] } }),
        MockData.getSyncedCase({ override: { caseId: caseIds[1] } }),
      ]);
    const result = await repo.getConsolidationChildCaseIds(predicate);
    expect(result).toEqual(caseIds);
  });

  test('should persist the case to sync', async () => {
    const bCase = MockData.getSyncedCase();
    const replaceSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue(null);

    const expected = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: bCase.caseId,
        },
        {
          condition: 'EQUALS',
          attributeName: 'documentType',
          value: 'SYNCED_CASE',
        },
      ],
    };

    await repo.syncDxtrCase(bCase);
    expect(replaceSpy).toHaveBeenCalledWith(expected, bCase, true);
  });

  test('should throw when replaceOne throws error', async () => {
    const bCase = MockData.getSyncedCase();
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockRejectedValue(new Error('some error'));

    await expect(repo.syncDxtrCase(bCase)).rejects.toThrow(UnknownError);
  });
});
