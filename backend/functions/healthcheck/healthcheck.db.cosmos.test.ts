import { describe } from 'node:test';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

describe('healthcheck db tests', () => {
  let context: ApplicationContext;
  let healthcheckRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    healthcheckRepository = new HealthcheckCosmosDb(context);
    jest.clearAllMocks();
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
