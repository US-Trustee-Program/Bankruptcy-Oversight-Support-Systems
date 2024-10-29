import { describe } from 'node:test';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { closeDeferred } from '../lib/defer-close';
import { MongoCollectionAdapter } from '../lib/adapters/gateways/mongo/mongo-adapter';
import { getCamsError } from '../lib/common-errors/error-utilities';

describe('healthcheck db tests', () => {
  let context: ApplicationContext;
  let healthcheckRepository;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    healthcheckRepository = new HealthcheckCosmosDb(context);
  });
  afterEach(async () => {
    await closeDeferred(context);
  });

  test('should handle read, write, and delete check correctly', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValueOnce(null)
      .mockResolvedValue([{}]);
    jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);

    let readResult = await healthcheckRepository.checkDbRead();
    expect(readResult).toEqual(false);

    const writeResult = await healthcheckRepository.checkDbWrite();
    expect(writeResult).toEqual(true);

    readResult = await healthcheckRepository.checkDbRead();
    expect(readResult).toEqual(true);

    const deleteResult = await healthcheckRepository.checkDbDelete();
    expect(deleteResult).toEqual(true);
  });
  describe('error handling', () => {
    const error = new Error('some error');
    const camsError = getCamsError(error, 'HEALTHCHECK-COSMOS-DB');

    test('should handle error properly on read, write, and delete check', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);
      const writeResult = await healthcheckRepository.checkDbWrite();
      const readResult = await healthcheckRepository.checkDbRead();
      const deleteResult = await healthcheckRepository.checkDbDelete();
      expect(writeResult).toEqual(false);
      expect(readResult).toEqual(false);
      expect(deleteResult).toEqual(false);
      expect(async () => await healthcheckRepository.checkDbWrite()).rejects.toThrow(camsError);
      expect(async () => await healthcheckRepository.checkDbRead()).rejects.toThrow(camsError);
      expect(async () => await healthcheckRepository.checkDbDelete()).rejects.toThrow(camsError);
    });
  });
});
