import { describe, test, expect, vi, afterEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ImportZoomCsvUseCase from '../../../lib/use-cases/dataflows/import-zoom-csv';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { handleStart } from './import-zoom-csv';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'import-zoom-csv',
    extraOutputs: { set: vi.fn(), get: vi.fn() },
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
  }) as unknown as InvocationContext;

describe('import-zoom-csv trigger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleStart', () => {
    test('should call importZoomCsv and log the result', async () => {
      const mockResult = { total: 3, matched: 2, unmatched: 1, ambiguous: 0, errors: 0 };
      vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockResolvedValue(mockResult);
      const invocationContext = makeInvocationContext();

      await handleStart({}, invocationContext);

      expect(ImportZoomCsvUseCase.importZoomCsv).toHaveBeenCalledOnce();
    });

    test('should log an error and not throw when importZoomCsv rejects with a non-429 error', async () => {
      vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockRejectedValue(new Error('storage error'));
      const invocationContext = makeInvocationContext();

      await expect(handleStart({}, invocationContext)).resolves.not.toThrow();
    });

    test('should rethrow a 429 error so Azure re-delivers the message', async () => {
      const tooManyError = new TooManyRequestsError('IMPORT-ZOOM-CSV');
      vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockRejectedValue(tooManyError);
      const invocationContext = makeInvocationContext();

      await expect(handleStart({}, invocationContext)).rejects.toThrow(tooManyError);
    });

    test('should not rethrow a non-429 error', async () => {
      vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockRejectedValue(
        new Error('unexpected error'),
      );
      const invocationContext = makeInvocationContext();

      await expect(handleStart({}, invocationContext)).resolves.not.toThrow();
    });
  });
});
