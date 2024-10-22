import { describe } from 'node:test';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { closeDeferred } from '../lib/defer-close';

describe('healthcheck db tests', () => {
  let context: ApplicationContext;
  let healthcheckRepository;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    healthcheckRepository = new HealthcheckCosmosDb(context);
  });
  afterAll(async () => {
    await closeDeferred(context);
  });

  test('should handle read, write, and delete check correctly', async () => {
    let readResult = await healthcheckRepository.checkDbRead();
    expect(readResult).toEqual(false);

    const writeResult = await healthcheckRepository.checkDbWrite();
    expect(writeResult).toEqual(true);

    readResult = await healthcheckRepository.checkDbRead();
    expect(readResult).toEqual(true);

    const deleteResult = await healthcheckRepository.checkDbDelete();
    expect(deleteResult).toEqual(true);
  });
});
