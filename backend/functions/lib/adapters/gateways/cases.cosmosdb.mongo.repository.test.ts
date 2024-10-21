import { TransferTo } from '../../../../../common/src/cams/events';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { CasesCosmosMongoDbRepository } from './cases.cosmosdb.mongo.repository';

describe.skip('Cases repository', () => {
  let repo: CasesCosmosMongoDbRepository;
  let context: ApplicationContext;
  const caseId1 = '111-11-11111';
  const caseId2 = '222-22-22222';
  // const transferIn: TransferFrom = {
  //   caseId: caseId2,
  //   otherCase: MockData.getCaseSummary({ override: { caseId: caseId1 } }),
  //   orderDate: '01/01/2024',
  //   documentType: 'TRANSFER_FROM',
  // };
  const transferOut: TransferTo = {
    caseId: caseId1,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId2 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_TO',
  };
  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosMongoDbRepository(context.config.cosmosConfig.mongoDbConnectionString);

    jest.clearAllMocks();
  });

  test.skip('should getTransfers', async () => {
    const caseId = '111-82-80331';
    const result = await repo.getTransfers(context, caseId);
    expect(result).not.toBeNull();
  });

  test('should createTransferTo', async () => {
    const result = await repo.createTransferTo(context, transferOut);
    expect(result).not.toBeNull();
    const response = await repo.getTransfers(context, caseId1);
    expect(response).not.toBeNull();
  });
});
