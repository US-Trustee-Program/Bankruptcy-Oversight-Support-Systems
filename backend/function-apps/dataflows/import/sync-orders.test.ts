import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import { timerTrigger } from './sync-orders';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as ContextCreator from '../../azure/application-context-creator';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import * as AzureFunctions from '../../azure/functions';
import { SyncOrdersStatus } from '../../../lib/use-cases/orders/orders';

const MODULE_NAME = 'SYNC-ORDERS';

const MOCK_SYNC_STATUS: SyncOrdersStatus = {
  initialSyncState: { documentType: 'ORDERS_SYNC_STATE', txId: '0' },
  finalSyncState: { documentType: 'ORDERS_SYNC_STATE', txId: '100' },
  length: 5,
  startingTxId: '0',
  maxTxId: '100',
};

describe('sync-orders timerTrigger', () => {
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
      functionName: 'sync-orders-timerTrigger',
      extraOutputs: {
        set: vi.fn(),
        get: vi.fn(),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  test('completes trace with success true when controller succeeds', async () => {
    vi.spyOn(OrdersController.prototype, 'handleTimer').mockResolvedValue(MOCK_SYNC_STATUS);

    await timerTrigger({} as Timer, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      MODULE_NAME,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: true,
        documentsWritten: MOCK_SYNC_STATUS.length,
      }),
    );
    expect(AzureFunctions.toAzureError).not.toHaveBeenCalled();
  });

  test('handles 429 gracefully: does not throw, emits rate-limited trace, skips toAzureError', async () => {
    const rateLimitError = new TooManyRequestsError(MODULE_NAME, {
      message: 'Rate limited',
    });
    vi.spyOn(OrdersController.prototype, 'handleTimer').mockRejectedValue(rateLimitError);

    await expect(timerTrigger({} as Timer, invocationContext)).resolves.toBeUndefined();

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      MODULE_NAME,
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
    const genericError = new CamsError(MODULE_NAME, {
      message: 'Something went wrong',
    });
    vi.spyOn(OrdersController.prototype, 'handleTimer').mockRejectedValue(genericError);

    await timerTrigger({} as Timer, invocationContext);

    expect(AzureFunctions.toAzureError).toHaveBeenCalledWith(
      expect.any(Object),
      MODULE_NAME,
      genericError,
    );
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.any(Object),
      mockTrace,
      MODULE_NAME,
      'timerTrigger',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }),
    );
  });
});
