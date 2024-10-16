import { ApplicationContext } from '../types/basic';
import { CasesCosmosDbRepository } from './cases.cosmosdb.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TransferTo, TransferFrom } from '../../../../../common/src/cams/events';
import { MockHumbleItems, MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import { AggregateAuthenticationError } from '@azure/identity';
import { CaseAssignmentHistory } from '../../../../../common/src/cams/history';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';

describe('Runtime State Repo', () => {
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
  const transfersArray: Array<TransferFrom | TransferTo> = [transferIn, transferOut];

  let context: ApplicationContext;
  let repo: CasesCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should get array of transfers when calling getTransfers', async () => {
    const fetchAll = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: transfersArray,
    });
    const actual = await repo.getTransfers(context, caseId1);
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(transfersArray);
  });

  test('should create a TransferIn document', async () => {
    const create = jest.spyOn(MockHumbleItems.prototype, 'create').mockResolvedValue({
      resource: transferIn,
    });
    const toCreate = { ...transferIn };
    const actual = await repo.createTransferFrom(context, toCreate);
    expect(create).toHaveBeenCalled();
    expect(actual.documentType).toEqual(toCreate.documentType);
  });

  test('should update a TransferOut document', async () => {
    const create = jest.spyOn(MockHumbleItems.prototype, 'create').mockResolvedValue({
      resource: transferOut,
    });
    const toCreate = { ...transferOut };
    const actual = await repo.createTransferTo(context, toCreate);
    expect(create).toHaveBeenCalled();
    expect(actual.documentType).toEqual(toCreate.documentType);
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const cosmosdbAggregateError = new AggregateAuthenticationError([], 'Mocked Test Error');
    const serverConfigError = new ServerConfigError('TEST', {
      message: 'Failed to authenticate to Azure',
      originalError: cosmosdbAggregateError,
    });
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockRejectedValue(cosmosdbAggregateError);
    jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(cosmosdbAggregateError);

    await expect(repo.getTransfers(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      serverConfigError,
    );
    await expect(repo.createTransferFrom(context, transferIn)).rejects.toThrow(serverConfigError);
    await expect(repo.createTransferTo(context, transferOut)).rejects.toThrow(serverConfigError);
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockRejectedValue(someError);
    jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(someError);

    await expect(repo.getTransfers(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError);
    await expect(repo.createTransferFrom(context, transferIn)).rejects.toThrow(someError);
    await expect(repo.createTransferTo(context, transferOut)).rejects.toThrow(someError);
  });
});

describe('Test case history cosmosdb repository tests', () => {
  let context: ApplicationContext;
  let repo: CasesCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CasesCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should return case history for attorney assignments', async () => {
    const caseId = CASE_HISTORY[0].caseId;
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: CASE_HISTORY });

    const actualAssignmentsOne = await repo.getCaseHistory(context, caseId);

    expect(actualAssignmentsOne.length).toEqual(2);
    expect(actualAssignmentsOne).toEqual(CASE_HISTORY);
  });

  test('should throw a permissions error when user doesnt have permission to create assignment history', async () => {
    const caseId = THROW_PERMISSIONS_ERROR_CASE_ID;
    const testCaseAssignmentHistory: CaseAssignmentHistory = {
      caseId,
      documentType: 'AUDIT_ASSIGNMENT',
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
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
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: new Date().toISOString(),
      before: [],
      after: [],
    };

    await expect(repo.createCaseHistory(context, testCaseAssignmentHistory)).rejects.toThrow(
      'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
    );
  });
});
