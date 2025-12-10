import { vi } from 'vitest';
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
    vi.restoreAllMocks();
  });

  test('should persist a new sync state and log', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(undefined);
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const lastSyncDate = new Date().toISOString();
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    await CasesRuntimeState.storeRuntimeState(context, lastSyncDate);
    expect(upsertSpy).toHaveBeenCalledWith({
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate,
    });
    expect(errorLogSpy).not.toHaveBeenCalled();
    expect(infoLogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Wrote runtime state: '),
      expect.anything(),
    );
  });

  test('should log CamsError', async () => {
    const original: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastSyncDate: '1000',
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(original);
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('some error'));
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    await expect(CasesRuntimeState.storeRuntimeState(context, '1001')).resolves.toBeUndefined();
    expect(errorLogSpy).toHaveBeenCalled();
    expect(infoLogSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Wrote runtime state: '),
      expect.anything(),
    );
  });
});
