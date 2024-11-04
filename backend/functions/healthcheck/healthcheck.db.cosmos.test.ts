import { describe } from 'node:test';

import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { closeDeferred } from '../lib/defer-close';

import HealthcheckCosmosDb, { HealthCheckDocument } from './healthcheck.db.cosmos';
import { MongoCollectionAdapter } from '../lib/adapters/gateways/mongo/utils/mongo-adapter';

describe('healthcheck db tests', () => {
  let context: ApplicationContext;
  let healthcheckRepository: HealthcheckCosmosDb;

  const healthCheckDocument: HealthCheckDocument = {
    id: 'some-id',
    healthCheckId: 'some-other-id',
    documentType: 'HEALTH_CHECK',
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
  test('should handle no documents to delete', async () => {});

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
