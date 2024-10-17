import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { CasesCosmosMongoDbRepository } from './cases.cosmosdb.mongo.repository';

describe.skip('Cases repository', () => {
  let repo: CasesCosmosMongoDbRepository;
  let context: ApplicationContext;
  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosMongoDbRepository(context.config.cosmosConfig.mongoDbConnectionString);

    jest.clearAllMocks();
  });

  test('should getTransfers', async () => {
    const caseId = '111-82-80331';
    const result = await repo.getTransfers(context, caseId);
    expect(result).not.toBeNull();
  });

  // test('should createCaseHistory', async () => {
  //   const caseHistory = MockData.getConsolidationHistory();
  //   expect(result).not.toBeNull();
  // });
});
