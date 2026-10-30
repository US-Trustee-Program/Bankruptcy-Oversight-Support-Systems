import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import CasesRuntimeState from './cases-runtime-state';
import { CamsError } from '../../common-errors/cams-error';

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

    const lastCasesSyncDate = new Date().toISOString();
    const lastTransactionsSyncDate = new Date().toISOString();
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    await CasesRuntimeState.storeRuntimeState(context, lastCasesSyncDate, lastTransactionsSyncDate);
    expect(upsertSpy).toHaveBeenCalledWith({
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate,
      lastTransactionsSyncDate,
    });
    expect(errorLogSpy).not.toHaveBeenCalled();
    expect(infoLogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Wrote runtime state: '),
      expect.anything(),
    );
  });

  test('should log and rethrow upsert failures as CamsError without logging success', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('some error'));
    const errorLogSpy = vi.spyOn(context.logger, 'camsError');
    const infoLogSpy = vi.spyOn(context.logger, 'info');
    const thrown = await CasesRuntimeState.storeRuntimeState(context, '1001', '1001').catch(
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(CamsError);
    expect((thrown as CamsError).message).toBe('Failed while storing the case sync runtime state.');
    expect(errorLogSpy).toHaveBeenCalledWith(thrown);
    expect(infoLogSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Wrote runtime state: '),
      expect.anything(),
    );
  });
});
