import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import { timerTrigger } from './sync-trustee-notes-metrics';
import { TrusteeNotesMetricsController } from '../../../lib/controllers/trustee-notes-metrics/trustee-notes-metrics.controller';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as ContextCreator from '../../azure/application-context-creator';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import * as AzureFunctions from '../../azure/functions';
import ModuleNames from '../module-names';

const MOCK_METRICS = {
  notesLast24Hrs: 10,
  trusteesWithNotes: 5,
  notesPerTrustee: [{ trusteeId: 'trustee-1', noteCount: 2 }],
  uniqueNoteAuthors: 3,
  totalTrustees: 20,
  trusteesWithNotesPercent: 25,
  usersWithNotePermission: 15,
  userEngagementPercent: 33,
};

describe('sync-trustee-notes-metrics timerTrigger', () => {
  let invocationContext: InvocationContext;
  let mockTrace: object;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const appContext = await createMockApplicationContext();
    mockTrace = { startTime: Date.now(), instanceId: 'test-trace-id' };

    vi.spyOn(appContext.observability, 'startTrace').mockReturnValue(mockTrace as never);
    vi.spyOn(ContextCreator.default, 'getApplicationContext').mockResolvedValue(appContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
    vi.spyOn(AzureFunctions, 'toAzureError').mockReturnValue({} as never);

    invocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'sync-trustee-notes-metrics-timerTrigger',
      extraOutputs: {
        set: vi.fn(),
        get: vi.fn(),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  test('completes trace with success true when controller succeeds', async () => {
    vi.spyOn(TrusteeNotesMetricsController.prototype, 'handleTimer').mockResolvedValue(
      MOCK_METRICS,
    );

    await timerTrigger({} as Timer, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_NOTES_METRICS,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: true,
      }),
    );
    expect(AzureFunctions.toAzureError).not.toHaveBeenCalled();
  });

  test('handles 429 gracefully: does not throw, emits rate-limited trace, skips toAzureError', async () => {
    const rateLimitError = new TooManyRequestsError(ModuleNames.SYNC_TRUSTEE_NOTES_METRICS, {
      message: 'Rate limited',
    });
    vi.spyOn(TrusteeNotesMetricsController.prototype, 'handleTimer').mockRejectedValue(
      rateLimitError,
    );

    await expect(timerTrigger({} as Timer, invocationContext)).resolves.toBeUndefined();

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_NOTES_METRICS,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'rate-limited',
      }),
    );
    expect(AzureFunctions.toAzureError).not.toHaveBeenCalled();
  });

  test('handles non-429 errors: calls toAzureError and emits failure trace', async () => {
    const genericError = new CamsError(ModuleNames.SYNC_TRUSTEE_NOTES_METRICS, {
      message: 'Something went wrong',
    });
    vi.spyOn(TrusteeNotesMetricsController.prototype, 'handleTimer').mockRejectedValue(
      genericError,
    );

    await timerTrigger({} as Timer, invocationContext);

    expect(AzureFunctions.toAzureError).toHaveBeenCalledWith(
      expect.any(Object),
      ModuleNames.SYNC_TRUSTEE_NOTES_METRICS,
      genericError,
    );
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_NOTES_METRICS,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }),
    );
  });
});
