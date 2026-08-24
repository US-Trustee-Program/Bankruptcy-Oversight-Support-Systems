import { vi } from 'vitest';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { OrderSyncState, ProfessionalIdCounterState } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { RuntimeStateMongoRepository } from './runtime-state.mongo.repository';
import * as crypto from 'crypto';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CamsError } from '../../../common-errors/cams-error';

describe('Runtime State Repo', () => {
  const expected: OrderSyncState = {
    id: crypto.randomUUID().toString(),
    documentType: 'ORDERS_SYNC_STATE',
    txId: '0',
  };
  let context: ApplicationContext;
  let repo: RuntimeStateMongoRepository<OrderSyncState>;
  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new RuntimeStateMongoRepository(context);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await closeDeferred(context);
  });

  test('should get a runtime state document', async () => {
    const findOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockResolvedValue(expected);
    const actual = await repo.read('ORDERS_SYNC_STATE');
    expect(findOneSpy).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  const successCases = [
    ['modify', 1, 0],
    ['upsert', 0, 1],
  ];
  test.each(successCases)(
    'should %s a runtime state document',
    async (_caseName: string, modifiedCount: number, upsertedCount: number) => {
      const replaceOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: expected.id, modifiedCount, upsertedCount });
      const toCreate = { ...expected };
      delete toCreate.id;
      await repo.upsert(toCreate);
      expect(replaceOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    },
  );

  test('should return undefined if upsert does not modify or upsert any document', async () => {
    const replaceOne = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: expected.id, modifiedCount: 0, upsertedCount: 0 });
    const toCreate = { ...expected };
    delete toCreate.id;
    const result = await repo.upsert(toCreate);
    expect(replaceOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(result).toBeUndefined();
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const findOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockRejectedValue(someError);
    const replaceSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockRejectedValue(someError);

    const expectedError = new UnknownError(expect.anything(), { originalError: someError });

    await expect(repo.read('ORDERS_SYNC_STATE')).rejects.toThrow(expectedError);
    expect(findOneSpy).toHaveBeenCalled();
    await expect(repo.upsert(expected)).rejects.toThrow(expectedError);
    expect(replaceSpy).toHaveBeenCalled();
  });

  describe('atomicDecrement', () => {
    let counterRepo: RuntimeStateMongoRepository<ProfessionalIdCounterState>;

    beforeEach(() => {
      counterRepo = new RuntimeStateMongoRepository<ProfessionalIdCounterState>(context);
    });

    test('should seed the counter then atomically decrement it via two findOneAndUpdate calls', async () => {
      const findOneAndUpdateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          documentType: 'PROFESSIONAL_ID_COUNTER',
          lastAssigned: 99999,
        });

      await counterRepo.atomicDecrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 100000);

      expect(findOneAndUpdateSpy).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          $set: { documentType: 'PROFESSIONAL_ID_COUNTER' },
          $setOnInsert: expect.objectContaining({ lastAssigned: 100000 }),
        }),
        { upsert: true },
      );
      expect(findOneAndUpdateSpy).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { $inc: { lastAssigned: -1 } },
        { returnDocument: 'after' },
      );
    });

    test('should return the post-decrement field value from the returned document', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          documentType: 'PROFESSIONAL_ID_COUNTER',
          lastAssigned: 99999,
        });

      const result = await counterRepo.atomicDecrement(
        'PROFESSIONAL_ID_COUNTER',
        'lastAssigned',
        100000,
      );
      expect(result).toEqual(99999);
    });

    test('should throw when the decrement step returns null', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        counterRepo.atomicDecrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 100000),
      ).rejects.toThrow(CamsError);
    });

    test('should rewrap driver errors via getCamsError', async () => {
      const driverError = new Error('driver-failure');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockRejectedValue(driverError);

      await expect(
        counterRepo.atomicDecrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 100000),
      ).rejects.toThrow(
        expect.objectContaining({
          isCamsError: true,
        }),
      );
    });
  });

  describe('atomicIncrement', () => {
    let counterRepo: RuntimeStateMongoRepository<ProfessionalIdCounterState>;

    beforeEach(() => {
      counterRepo = new RuntimeStateMongoRepository<ProfessionalIdCounterState>(context);
    });

    test('should atomically increment the field via a single findOneAndUpdate $inc', async () => {
      const findOneAndUpdateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue({
          documentType: 'PROFESSIONAL_ID_COUNTER',
          lastAssigned: 5,
        });

      await counterRepo.atomicIncrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 1);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { lastAssigned: 1 } },
        { returnDocument: 'after' },
      );
    });

    test('should default amount to 1 when not provided', async () => {
      const findOneAndUpdateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue({
          documentType: 'PROFESSIONAL_ID_COUNTER',
          lastAssigned: 1,
        });

      await counterRepo.atomicIncrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned');

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { lastAssigned: 1 } },
        { returnDocument: 'after' },
      );
    });

    test('should return the post-increment field value from the returned document', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockResolvedValue({
        documentType: 'PROFESSIONAL_ID_COUNTER',
        lastAssigned: 42,
      });

      const result = await counterRepo.atomicIncrement(
        'PROFESSIONAL_ID_COUNTER',
        'lastAssigned',
        1,
      );

      expect(result).toEqual(42);
    });

    test('should throw when the document is not found', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        counterRepo.atomicIncrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 1),
      ).rejects.toThrow(CamsError);
    });

    test('should throw when the incremented field is not a number', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockResolvedValue({
        documentType: 'PROFESSIONAL_ID_COUNTER',
        lastAssigned: 'not-a-number' as unknown as number,
      });

      await expect(
        counterRepo.atomicIncrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 1),
      ).rejects.toThrow(CamsError);
    });

    test('should rewrap driver errors via getCamsError', async () => {
      const driverError = new Error('driver-failure');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockRejectedValue(driverError);

      await expect(
        counterRepo.atomicIncrement('PROFESSIONAL_ID_COUNTER', 'lastAssigned', 1),
      ).rejects.toThrow(
        expect.objectContaining({
          isCamsError: true,
        }),
      );
    });
  });

  describe('setField', () => {
    test('should atomically $set the given dotted path via a single findOneAndUpdate, upserting if absent', async () => {
      const findOneAndUpdateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue({ documentType: 'ORDERS_SYNC_STATE' });

      await repo.setField('ORDERS_SYNC_STATE', 'someMap.NY', 63);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { 'someMap.NY': 63 }, $setOnInsert: { documentType: 'ORDERS_SYNC_STATE' } },
        { upsert: true },
      );
    });

    test('should rewrap driver errors via getCamsError', async () => {
      const driverError = new Error('driver-failure');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockRejectedValue(driverError);

      await expect(repo.setField('ORDERS_SYNC_STATE', 'someMap.NY', 63)).rejects.toThrow(
        expect.objectContaining({ isCamsError: true }),
      );
    });
  });
});
