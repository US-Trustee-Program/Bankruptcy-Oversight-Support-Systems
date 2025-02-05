import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { CasesSyncState } from '../gateways.types';
import CasesRuntimeState from './cases-runtime-state';

describe('storeRuntimeState tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should persist a new sync state when transaction id is not provided', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);
    const txId = '1001';
    jest.spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId').mockResolvedValue(txId);

    await CasesRuntimeState.storeRuntimeState(context);
    expect(upsertSpy).toHaveBeenCalledWith({ documentType: 'CASES_SYNC_STATE', txId });
  });

  test('should persist a new sync state', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const txId = '1001';
    await CasesRuntimeState.storeRuntimeState(context, txId);
    expect(upsertSpy).toHaveBeenCalledWith({
      documentType: 'CASES_SYNC_STATE',
      txId,
    });
  });

  test('should persist a higher transaction id', async () => {
    const original: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      txId: '1000',
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(original);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const txId = '1001';
    await CasesRuntimeState.storeRuntimeState(context, txId);
    expect(upsertSpy).toHaveBeenCalledWith({ ...original, txId });
  });

  test('should not persist a lower transaction id', async () => {
    const original: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      txId: '1000',
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(original);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockRejectedValue(new Error('this should not be called'));

    const txId = '1';
    await CasesRuntimeState.storeRuntimeState(context, txId);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  test('should throw CamsError', async () => {
    const original: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      txId: '1000',
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(original);
    jest.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('some error'));
    await expect(CasesRuntimeState.storeRuntimeState(context, '1001')).resolves.toBeUndefined();
  });

  test('should throw error if gateway throws', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    jest
      .spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId')
      .mockRejectedValue(new Error('some error'));

    await expect(CasesRuntimeState.storeRuntimeState(context)).resolves.toBeUndefined();
  });

  test('should throw error if max transaction id cannot be determined', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    jest.spyOn(CasesLocalGateway.prototype, 'findMaxTransactionId').mockResolvedValue(undefined);

    await expect(CasesRuntimeState.storeRuntimeState(context)).resolves.toBeUndefined();
  });
});
