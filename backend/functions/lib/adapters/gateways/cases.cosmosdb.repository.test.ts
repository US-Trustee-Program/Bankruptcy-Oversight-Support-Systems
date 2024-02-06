import { ApplicationContext } from '../types/basic';
import { CasesCosmosDbRepository } from './cases.cosmosdb.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TransferIn, TransferOut } from '../../use-cases/orders/orders.model';
import { HumbleItem, HumbleItems, HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { throwAggregateAuthenticationError } from '../../testing/mock.cosmos-client-humble.helpers';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import { CaseAssignmentHistory } from '../types/case.history';

describe('Runtime State Repo', () => {
  const caseId1 = '111-11-11111';
  const caseId2 = '222-22-22222';
  const transferIn: TransferIn = {
    caseId: caseId2,
    otherCaseId: caseId1,
    orderDate: '01/01/2024',
    divisionName: 'Test Division Name 2',
    courtName: 'Test Court Name 2',
    documentType: 'TRANSFER_IN',
  };
  const transferOut: TransferOut = {
    caseId: caseId1,
    otherCaseId: caseId2,
    orderDate: '01/01/2024',
    divisionName: 'Test Division Name 1',
    courtName: 'Test Court Name 1',
    documentType: 'TRANSFER_OUT',
  };
  const transfersArray: Array<TransferIn | TransferOut> = [transferIn, transferOut];

  let context: ApplicationContext;
  let repo: CasesCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repo = new CasesCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should get array of transfers when calling getTransfers', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: transfersArray,
    });
    const actual = await repo.getTransfers(context, caseId1);
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(transfersArray);
  });

  test('should create a TransferIn document', async () => {
    const create = jest.spyOn(HumbleItems.prototype, 'create').mockResolvedValue({
      item: transferIn,
    });
    const toCreate = { ...transferIn };
    const actual = await repo.createTransferIn(context, toCreate);
    expect(create).toHaveBeenCalled();
    expect(actual.documentType).toEqual(toCreate.documentType);
  });

  test('should update a TransferOut document', async () => {
    const create = jest.spyOn(HumbleItems.prototype, 'create').mockResolvedValue({
      item: transferOut,
    });
    const toCreate = { ...transferOut };
    const actual = await repo.createTransferOut(context, toCreate);
    expect(create).toHaveBeenCalled();
    expect(actual.documentType).toEqual(toCreate.documentType);
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const serverConfigError = new ServerConfigError('TEST', {
      message: 'Failed to authenticate to Azure',
    });
    jest
      .spyOn(HumbleQuery.prototype, 'fetchAll')
      .mockImplementation(
        throwAggregateAuthenticationError<{ resources: Array<TransferIn | TransferOut> }>(),
      );

    jest
      .spyOn(HumbleItem.prototype, 'replace')
      .mockImplementation(throwAggregateAuthenticationError());

    jest
      .spyOn(HumbleItems.prototype, 'create')
      .mockImplementation(throwAggregateAuthenticationError<void>());

    await expect(repo.getTransfers(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      serverConfigError,
    );
    await expect(repo.createTransferIn(context, transferIn)).rejects.toThrow(serverConfigError);
    await expect(repo.createTransferOut(context, transferOut)).rejects.toThrow(serverConfigError);
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockRejectedValue(someError);
    jest.spyOn(HumbleItem.prototype, 'replace').mockRejectedValue(someError);
    jest.spyOn(HumbleItems.prototype, 'create').mockRejectedValue(someError);

    await expect(repo.getTransfers(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError);
    await expect(repo.createTransferIn(context, transferIn)).rejects.toThrow(someError);
    await expect(repo.createTransferOut(context, transferOut)).rejects.toThrow(someError);
  });
});

describe('Test case history cosmosdb repository tests', () => {
  let context: ApplicationContext;
  let repo: CasesCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repo = new CasesCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should return case history for attorney assignments', async () => {
    const caseId = CASE_HISTORY[0].caseId;
    jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({ resources: CASE_HISTORY });

    const actualAssignmentsOne = await repo.getCaseHistory(context, caseId);

    expect(actualAssignmentsOne.length).toEqual(2);
    expect(actualAssignmentsOne).toEqual(CASE_HISTORY);
  });

  test('should throw a permissions error when user doesnt have permission to create assignment history', async () => {
    const caseId = THROW_PERMISSIONS_ERROR_CASE_ID;
    const testCaseAssignmentHistory: CaseAssignmentHistory = {
      caseId,
      documentType: 'AUDIT_ASSIGNMENT',
      occurredAtTimestamp: new Date().toISOString(),
      before: [],
      after: [],
    };

    await expect(repo.createCaseHistory(context, testCaseAssignmentHistory)).rejects.toThrow(
      'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
    );
  });

  test('should throw UnknownError if an unknown error occurs', async () => {
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID;
    const testCaseAssignmentHistory: CaseAssignmentHistory = {
      caseId,
      documentType: 'AUDIT_ASSIGNMENT',
      occurredAtTimestamp: new Date().toISOString(),
      before: [],
      after: [],
    };

    await expect(repo.createCaseHistory(context, testCaseAssignmentHistory)).rejects.toThrow(
      'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
    );
  });
});
