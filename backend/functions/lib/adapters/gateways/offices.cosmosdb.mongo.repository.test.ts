import { OfficesCosmosMongoDbRepository } from './offices.cosmosdb.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';

describe('offices repo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.only('getOfficeAttorneys', async () => {
    const context = await createMockApplicationContext();
    const repo = new OfficesCosmosMongoDbRepository(
      context.config.cosmosConfig.mongoDbConnectionString,
    );
    const attorneys = await repo.getOfficeAttorneys(context, 'my_house');

    console.log(attorneys);
    expect(attorneys).not.toBeNull();
  });

  test('putOfficeStaff', async () => {
    const context = await createMockApplicationContext();
    const session = await createMockApplicationContextSession();
    const repo = new OfficesCosmosMongoDbRepository(
      context.config.cosmosConfig.mongoDbConnectionString,
    );
    const attorneys = await repo.putOfficeStaff(context, 'my_house', session.user);

    console.log(attorneys);
    expect(attorneys).not.toBeNull();
  });
});
