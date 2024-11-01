import { SYSTEM_USER_REFERENCE } from '../../../../../../common/src/cams/auditable';
import { TransferFrom, TransferTo } from '../../../../../../common/src/cams/events';
import { CaseAssignmentHistory } from '../../../../../../common/src/cams/history';
import MockData from '../../../../../../common/src/cams/test-utilities/mock-data';
import { CamsError } from '../../../common-errors/cams-error';
import { closeDeferred } from '../../../defer-close';
import { CASE_HISTORY } from '../../../testing/mock-data/case-history.mock';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CasesMongoRepository } from './cases.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import * as crypto from 'crypto';

describe('Cases repository', () => {
  let repo: CasesMongoRepository;
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

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
  });

  test('should getTransfers', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^TRANSFER_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const transfers = MockData.buildArray(MockData.getTransferOrder, 5);
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(transfers);
    const result = await repo.getTransfers('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(transfers);
  });

  test('should getConsolidation', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^CONSOLIDATION_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 5);
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(consolidations);
    const result = await repo.getConsolidation('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(consolidations);
  });

  test('should throw error in getConsolidation when find throws', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    expect(async () => await repo.getConsolidation('111-82-80331')).rejects.toThrow(
      'Unknown Error',
    );
  });

  test('should getCaseHistory', async () => {
    const query = {
      conjunction: 'AND',
      values: [
        {
          condition: 'REGEX',
          attributeName: 'documentType',
          value: '^AUDIT_',
        },
        {
          condition: 'EQUALS',
          attributeName: 'caseId',
          value: '111-82-80331',
        },
      ],
    };
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(CASE_HISTORY);
    const result = await repo.getCaseHistory('111-82-80331');
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(result).toEqual(CASE_HISTORY);
  });

  test('should throw error in getCaseHistory when find throws', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    expect(async () => await repo.getCaseHistory('111-82-80331')).rejects.toThrow('Unknown Error');
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

  test('createCaseHistory should throw error when insertOne throws error', async () => {
    const caseHistory: CaseAssignmentHistory = {
      caseId: caseId1,
      documentType: 'AUDIT_ASSIGNMENT',
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
      before: [],
      after: [],
    };
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockRejectedValue(new CamsError('COSMOS_DB_REPOSITORY_CASES'));
    expect(async () => await repo.createCaseHistory(caseHistory)).rejects.toThrow(
      'Unknown CAMS Error',
    );
  });
});
