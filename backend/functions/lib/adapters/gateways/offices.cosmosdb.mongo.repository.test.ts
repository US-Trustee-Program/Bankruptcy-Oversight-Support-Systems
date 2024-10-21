import { OfficesCosmosMongoDbRepository } from './offices.cosmosdb.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';

describe('offices repo', () => {
  let context: ApplicationContext;
  let repo: OfficesCosmosMongoDbRepository;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    repo = new OfficesCosmosMongoDbRepository(context);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (repo) await repo.close();
  });

  test.only('getOfficeAttorneys', async () => {
    const attorneys = await repo.getOfficeAttorneys(context, 'my_house');

    expect(attorneys).not.toBeNull();
  });

  test('putOfficeStaff', async () => {
    const session = await createMockApplicationContextSession();
    const attorneys = await repo.putOfficeStaff(context, 'my_house', session.user);

    expect(attorneys).not.toBeNull();
  });
});
