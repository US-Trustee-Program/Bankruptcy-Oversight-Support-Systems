import { OfficesCosmosMongoDbRepository } from './offices.cosmosdb.mongo.repository';

describe('offices repo', () => {
  test('getOfficeAttorneys', async () => {
    const repo = new OfficesCosmosMongoDbRepository();
    const attorneys = await repo.getOfficeAttorneys(undefined, undefined);

    console.log(attorneys);
    expect(attorneys).not.toBeNull();
  }, 10000);
});
