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

  test('on success, calls notify() and completes the trace with the attempted/failed counts and the per-invocation logger', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    const notifySpy = vi
      .spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify')
      .mockResolvedValue({
        attempted: 2,
        failed: 0,
        failures: [],
      });
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');
    const event = makeEvent();

    await handler(event, makeInvocationContext());

    expect(notifySpy).toHaveBeenCalledWith(context, event.changeSet);
    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({
        success: true,
        properties: { attempted: '2', failed: '0' },
      }),
      undefined,
      context.logger,
    );
  });

  test('on a partial failure, completes the trace with success: false and routes the event and failures to the DLQ', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    const failures = [{ reason: 'send' as const, message: 'boom' }];
    const notifySpy = vi
      .spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify')
      .mockResolvedValue({
        attempted: 2,
        failed: 1,
        failures,
      });
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const event = makeEvent();

    await handler(event, invocationContext);

    expect(notifySpy).toHaveBeenCalledWith(context, event.changeSet);
    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({
        success: false,
        properties: { attempted: '2', failed: '1' },
      }),
      undefined,
      context.logger,
    );
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
      event,
      error: {
        message: 'Trustee change notification partially failed: 1 of 2 recipient(s).',
        failures,
      },
    });
  });

  test('on full success, does not route anything to the DLQ', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockResolvedValue({
      attempted: 2,
      failed: 0,
      failures: [],
    });
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');

    await handler(makeEvent(), invocationContext);

    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('on an uncaught exception, routes the event and a serialized error to the DLQ, completes the trace with success: false and the per-invocation logger, and does not rethrow', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    const originalError = new Error('notify blew up');
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockRejectedValue(originalError);
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');
    const errorSpy = vi.spyOn(context.logger, 'error');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const event = makeEvent();

    await expect(handler(event, invocationContext)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'TRUSTEE-CHANGE-NOTIFICATION',
      'Uncaught exception dispatching trustee change notification.',
      originalError,
    );
    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Trustee Change Notification',
      expect.objectContaining({ success: false }),
      undefined,
      context.logger,
    );
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
      event,
      error: {
        name: 'Error',
        message: 'notify blew up',
        stack: originalError.stack,
      },
    });
  });

  test('on an uncaught exception with a non-Error value, serializes it via String()', async () => {
    const { handler } = await import('./trustee-change-notification-event');
    const context = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(context);
    vi.spyOn(TrusteeChangeNotificationUseCase.prototype, 'notify').mockRejectedValue(
      'not-an-error',
    );
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const event = makeEvent();

    await handler(event, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
      event,
      error: { message: 'not-an-error' },
    });
  });
});
