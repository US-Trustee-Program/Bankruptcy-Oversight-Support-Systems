import { vi } from 'vitest';
import { describe } from 'node:test';

import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { closeDeferred } from '../../../lib/deferrable/defer-close';

import HealthcheckCosmosDb, { HealthCheckDocument } from './healthcheck.db.cosmos';
import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';

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
    vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([healthCheckDocument]);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    const result = await healthcheckRepository.checkDocumentDb();

    expect(result.cosmosDbDeleteStatus).toEqual(true);
    expect(result.cosmosDbReadStatus).toEqual(true);
    expect(result.cosmosDbWriteStatus).toEqual(true);
  });

  test('should handle no documents', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([]);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    const result = await healthcheckRepository.checkDocumentDb();

    expect(result.cosmosDbDeleteStatus).toEqual(false);
    expect(result.cosmosDbReadStatus).toEqual(false);
    expect(result.cosmosDbWriteStatus).toEqual(true);
  });

  describe('error handling', () => {
    const error = new Error('some error');

    test('should handle error properly on read, write, and delete check', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockRejectedValue(error);
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);
      const result = await healthcheckRepository.checkDocumentDb();
      expect(result.cosmosDbDeleteStatus).toEqual(false);
      expect(result.cosmosDbReadStatus).toEqual(false);
      expect(result.cosmosDbWriteStatus).toEqual(false);
    });
  });
});
