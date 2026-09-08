import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TrusteeChangeNotificationUseCase } from '../../../lib/use-cases/notifications/trustee-change-notification';
import { TRUSTEE_CHANGE_NOTIFICATION_DLQ } from '../../../lib/storage-queues';
import { TrusteeChangeNotificationEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'trustee-change-notification-event',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeEvent = (): TrusteeChangeNotificationEvent => ({
  changeSet: {
    trusteeId: 'trustee-123',
    trusteeName: 'Jane Trustee',
    fields: [
      {
        label: 'Name',
        comparisons: [{ before: 'A', after: 'B' }],
        category: 'profile',
        section: 'appointment',
      },
    ],
  },
});

describe('trustee-change-notification-event handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('on success, calls notify() and completes the trace with the attempted/failed counts', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockResolvedValue({
      attempted: 2,
      failed: 0,
      failures: [],
    });
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

    await handler(makeEvent(), makeInvocationContext());

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({
        success: true,
        properties: { attempted: '2', failed: '0' },
      }),
    );
  });

  test('on a partial failure, completes the trace with success: false', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockResolvedValue({
      attempted: 2,
      failed: 1,
      failures: [{ reason: 'send', message: 'boom' }],
    });
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

    await handler(makeEvent(), makeInvocationContext());

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({
        success: false,
        properties: { attempted: '2', failed: '1' },
      }),
    );
  });

  test('on an uncaught exception, routes the event and error to the DLQ, completes the trace with success: false, and does not rethrow', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    const originalError = new Error('notify blew up');
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockRejectedValue(originalError);
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const event = makeEvent();

    await expect(handler(event, invocationContext)).resolves.toBeUndefined();

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({ success: false }),
    );
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
      event,
      error: originalError,
    });
  });
});
