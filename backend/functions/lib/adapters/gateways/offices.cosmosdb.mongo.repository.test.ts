import { OfficesCosmosMongoDbRepository } from './offices.cosmosdb.mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';

describe('offices repo', () => {
  test('getOfficeAttorneys', async () => {
    const context = await createMockApplicationContext();
    const repo = new OfficesCosmosMongoDbRepository(
      context.config.cosmosConfig.mongoDbConnectionString,
    );
    const attorneys = await repo.getOfficeAttorneys(undefined, undefined);

    console.log(attorneys);
    expect(attorneys).not.toBeNull();
  }, 10000);
});
