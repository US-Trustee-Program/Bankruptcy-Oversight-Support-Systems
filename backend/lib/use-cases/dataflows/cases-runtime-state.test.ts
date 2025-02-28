import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
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

  test('should persist a new sync state', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const lastSyncDate = new Date().toISOString();
    await CasesRuntimeState.storeRuntimeState(context, lastSyncDate);
    expect(upsertSpy).toHaveBeenCalledWith({
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate,
    });
  });

  test('should throw CamsError', async () => {
    const original: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate: '1000',
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(original);
    jest.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('some error'));
    await expect(CasesRuntimeState.storeRuntimeState(context, '1001')).resolves.toBeUndefined();
  });
});
