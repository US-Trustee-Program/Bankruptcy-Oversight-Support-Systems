import { SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { TransferFrom, TransferTo } from '../../../../../common/src/cams/events';
import { CaseAssignmentHistory } from '../../../../../common/src/cams/history';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { closeDeferred } from '../../defer-close';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { CasesCosmosMongoDbRepository } from './cases.cosmosdb.mongo.repository';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';

describe('Cases repository', () => {
  let repo: CasesCosmosMongoDbRepository;
  let context: ApplicationContext;
  const caseId1 = '111-11-11111';
  const caseId2 = '222-22-22222';

  const transferIn: TransferFrom = {
    caseId: caseId2,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId1 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_FROM',
  };

  const transferOut: TransferTo = {
    caseId: caseId1,
    otherCase: MockData.getCaseSummary({ override: { caseId: caseId2 } }),
    orderDate: '01/01/2024',
    documentType: 'TRANSFER_TO',
  };

  // const transfersArray: Array<TransferFrom | TransferTo> = [transferIn, transferOut];

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosMongoDbRepository(context);
  });
  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
  });

  test('should getTransfers', async () => {
    const caseId = '111-82-80331';
    const transfers = MockData.buildArray(MockData.getTransferOrder, 2);
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(transfers);
    const result = await repo.getTransfers(caseId);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should createTransferTo', async () => {
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferTo(transferOut);
    expect(result).not.toBeNull();
    expect(insertOneSpy).toHaveBeenCalledWith(transferOut);
  });
  test('should createTransferFrom', async () => {
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createTransferFrom(transferIn);
    expect(insertOneSpy).toHaveBeenCalledWith(transferIn);
    expect(result).not.toBeNull();
  });
  test('should createConsolidationTo', async () => {
    const consolidaitonTo = MockData.getConsolidationTo();
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationTo(consolidaitonTo);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidaitonTo);

    expect(result).not.toBeNull();
  });
  test('should createConsolidationFrom', async () => {
    const consolidationFrom = MockData.getConsolidationFrom();
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createConsolidationFrom(consolidationFrom);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationFrom);
    expect(result).not.toBeNull();
  });
  test('should createCaseHistory', async () => {
    const caseHistory: CaseAssignmentHistory = {
      caseId: caseId1,
      documentType: 'AUDIT_ASSIGNMENT',
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
      before: [],
      after: [],
    };
    const insertOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(crypto.randomUUID().toString());
    const result = await repo.createCaseHistory(caseHistory);
    expect(insertOneSpy).toHaveBeenCalledWith(caseHistory);

    expect(result).not.toBeNull();
  });
});
