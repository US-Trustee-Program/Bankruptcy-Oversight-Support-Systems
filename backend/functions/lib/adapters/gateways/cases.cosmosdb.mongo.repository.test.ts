import { TransferTo } from '../../../../../common/src/cams/events';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { CasesCosmosMongoDbRepository } from './cases.cosmosdb.mongo.repository';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';

describe('Cases repository', () => {
  let repo: CasesCosmosMongoDbRepository;
  let context: ApplicationContext;
  const caseId1 = '111-11-11111';
  const caseId2 = '222-22-22222';

  const transferOut: TransferTo = {
    caseId: caseId1,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId2 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_TO',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosMongoDbRepository(context);

    jest.clearAllMocks();
  });

  test('should getTransfers', async () => {
    const caseId = '111-82-80331';
    const transfers = MockData.buildArray(MockData.getTransferOrder, 2);
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(transfers);
    const result = await repo.getTransfers(caseId);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should createTransferTo', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 2);
    jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(transfers[0].id);
    const result = await repo.createTransferTo(transferOut);
    expect(result).not.toBeNull();
  });
});
