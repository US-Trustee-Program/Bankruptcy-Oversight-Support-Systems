import { describe } from 'node:test';

import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { closeDeferred } from '../../../lib/deferrable/defer-close';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import HealthcheckCosmosDb, { HealthCheckDocument } from './healthcheck.db.cosmos';

describe('healthcheck db tests', () => {
  let context: ApplicationContext;
  let healthcheckRepository: HealthcheckCosmosDb;

  const healthCheckDocument: HealthCheckDocument = {
    documentType: 'HEALTH_CHECK',
    healthCheckId: 'some-other-id',
    id: 'some-id',
  };

  beforeAll(async () => {
    context = await createMockApplicationContext();
    healthcheckRepository = new HealthcheckCosmosDb(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
  });

  test('should handle read, write, and delete check correctly', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([healthCheckDocument]);
    jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    const result = await healthcheckRepository.checkDocumentDb();

    expect(result.cosmosDbDeleteStatus).toEqual(true);
    expect(result.cosmosDbReadStatus).toEqual(true);

    expect(result.cosmosDbWriteStatus).toEqual(true);
  });

  /* eslint-disable-next-line jest/expect-expect */
  test('should handle no documents to delete', async () => {
    // TODO: test this
  });

  describe('error handling', () => {
    const error = new Error('some error');

    test('should handle error properly on read, write, and delete check', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockRejectedValue(error);
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);
      const result = await healthcheckRepository.checkDocumentDb();
      expect(result.cosmosDbDeleteStatus).toEqual(false);
      expect(result.cosmosDbReadStatus).toEqual(false);
      expect(result.cosmosDbWriteStatus).toEqual(false);
    });
  });
});
