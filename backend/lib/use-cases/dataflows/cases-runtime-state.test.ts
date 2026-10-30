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
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const lastCasesSyncDate = new Date().toISOString();
    const lastTransactionsSyncDate = new Date().toISOString();
    const lastTransactionsTxId = 12345;
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    await CasesRuntimeState.storeRuntimeState(
      context,
      lastCasesSyncDate,
      lastTransactionsSyncDate,
      lastTransactionsTxId,
    );
    expect(upsertSpy).toHaveBeenCalledWith({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate,
      lastTransactionsSyncDate,
      lastTransactionsTxId,
    });
    expect(errorLogSpy).not.toHaveBeenCalled();
    expect(infoLogSpy).toHaveBeenCalled();
  });

  test('should omit lastTransactionsTxId from state document when not provided', async () => {
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(undefined);

    const lastCasesSyncDate = '2025-01-01T00:00:00.000Z';
    const lastTransactionsSyncDate = '2025-01-01T00:00:00.000Z';
    await CasesRuntimeState.storeRuntimeState(context, lastCasesSyncDate, lastTransactionsSyncDate);

    const upserted = upsertSpy.mock.calls[0][0] as CasesSyncState;
    expect(upserted).not.toHaveProperty('lastTransactionsTxId');
  });

  test('should log CamsError', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('some error'));
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    await expect(
      CasesRuntimeState.storeRuntimeState(context, '1001', '1001', 1001),
    ).resolves.toBeUndefined();
    expect(errorLogSpy).toHaveBeenCalled();
    expect(infoLogSpy).not.toHaveBeenCalledWith(
      'CASE-RUNTIME-STATE',
      expect.anything(),
      expect.anything(),
    );
  });
});
