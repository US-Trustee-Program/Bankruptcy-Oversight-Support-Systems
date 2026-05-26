import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import { timerTrigger } from './sync-trustee-due-date-metrics';
import { TrusteeDueDateMetricsController } from '../../../lib/controllers/trustee-due-date-metrics/trustee-due-date-metrics.controller';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as ContextCreator from '../../azure/application-context-creator';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import * as AzureFunctions from '../../azure/functions';
import ModuleNames from '../module-names';

const MOCK_METRICS = {
  totalChapter7Appointments: 100,
  completeCount: 60,
  partialCount: 25,
  noneCount: 15,
  completePercent: 60,
  partialPercent: 25,
  nonePercent: 15,
  tprReviewPeriodPercent: 80,
  pastFieldExamPercent: 70,
  pastAuditPercent: 65,
  tirReviewPeriodPercent: 75,
  lastAuditFiscalYearPercent: 50,
  tirFrequencyPercent: 90,
  tprDueDatePercent: 55,
  upcomingExamOrAuditYearPercent: 40,
  tirSubmissionPercent: 85,
  tirReviewDueDatePercent: 45,
};

describe('sync-trustee-due-date-metrics timerTrigger', () => {
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
      functionName: 'sync-trustee-due-date-metrics-timerTrigger',
      extraOutputs: {
        set: vi.fn(),
        get: vi.fn(),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  test('completes trace with success true when controller succeeds', async () => {
    vi.spyOn(TrusteeDueDateMetricsController.prototype, 'handleTimer').mockResolvedValue(
      MOCK_METRICS,
    );

    await timerTrigger({} as Timer, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: true,
      }),
    );
    expect(AzureFunctions.toAzureError).not.toHaveBeenCalled();
  });

  test('handles 429 gracefully: does not throw, emits rate-limited trace, skips toAzureError', async () => {
    const rateLimitError = new TooManyRequestsError(ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS, {
      message: 'Rate limited',
    });
    vi.spyOn(TrusteeDueDateMetricsController.prototype, 'handleTimer').mockRejectedValue(
      rateLimitError,
    );

    await expect(timerTrigger({} as Timer, invocationContext)).resolves.toBeUndefined();

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
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
    const genericError = new CamsError(ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS, {
      message: 'Something went wrong',
    });
    vi.spyOn(TrusteeDueDateMetricsController.prototype, 'handleTimer').mockRejectedValue(
      genericError,
    );

    await timerTrigger({} as Timer, invocationContext);

    expect(AzureFunctions.toAzureError).toHaveBeenCalledWith(
      expect.any(Object),
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
      genericError,
    );
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }),
    );
  });
});
