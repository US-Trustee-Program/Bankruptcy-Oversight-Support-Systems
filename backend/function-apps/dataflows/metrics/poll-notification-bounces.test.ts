import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import { timerTrigger } from './poll-notification-bounces';
import { BouncePollUseCase } from '../../../lib/use-cases/notifications/bounce-poll';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as ContextCreator from '../../azure/application-context-creator';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import * as AzureFunctions from '../../azure/functions';
import ModuleNames from '../module-names';

describe('poll-notification-bounces timerTrigger', () => {
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
      functionName: 'poll-notification-bounces-timerTrigger',
      extraOutputs: {
        set: vi.fn(),
        get: vi.fn(),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  test('completes trace with success true and bounce counts when the poll succeeds', async () => {
    vi.spyOn(BouncePollUseCase.prototype, 'pollAndReconstruct').mockResolvedValue({
      found: 3,
      reconstructed: 2,
      failed: 1,
    });

    await timerTrigger({} as Timer, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.POLL_NOTIFICATION_BOUNCES,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        documentsWritten: 2,
        documentsFailed: 1,
        success: true,
        details: { bouncesFound: '3' },
      }),
    );
    expect(AzureFunctions.toAzureError).not.toHaveBeenCalled();
  });

  test('handles errors: calls toAzureError and emits failure trace', async () => {
    const genericError = new CamsError(ModuleNames.POLL_NOTIFICATION_BOUNCES, {
      message: 'Something went wrong',
    });
    vi.spyOn(BouncePollUseCase.prototype, 'pollAndReconstruct').mockRejectedValue(genericError);

    await timerTrigger({} as Timer, invocationContext);

    expect(AzureFunctions.toAzureError).toHaveBeenCalledWith(
      expect.any(Object),
      ModuleNames.POLL_NOTIFICATION_BOUNCES,
      genericError,
    );
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      ModuleNames.POLL_NOTIFICATION_BOUNCES,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }),
    );
  });
});
