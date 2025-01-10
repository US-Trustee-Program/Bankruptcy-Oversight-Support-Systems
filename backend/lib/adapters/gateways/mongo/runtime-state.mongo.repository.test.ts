import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { OrderSyncState } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { RuntimeStateMongoRepository } from './runtime-state.mongo.repository';
import * as crypto from 'crypto';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { UnknownError } from '../../../common-errors/unknown-error';

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
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await closeDeferred(context);
  });

  test('should get a runtime state document', async () => {
    const findOneSpy = jest
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
      const replaceOne = jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: expected.id, modifiedCount, upsertedCount });
      const toCreate = { ...expected };
      delete toCreate.id;
      await repo.upsert(toCreate);
      expect(replaceOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    },
  );

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const findOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockRejectedValue(someError);
    const replaceSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockRejectedValue(someError);

    const expectedError = new UnknownError(expect.anything(), { originalError: someError });

    await expect(repo.read('ORDERS_SYNC_STATE')).rejects.toThrow(expectedError);
    expect(findOneSpy).toHaveBeenCalled();
    await expect(repo.upsert(expected)).rejects.toThrow(expectedError);
    expect(replaceSpy).toHaveBeenCalled();
  });
});
