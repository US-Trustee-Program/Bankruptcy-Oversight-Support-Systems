import { describe, test, expect, vi } from 'vitest';

/**
 * Regression coverage for a class of bug discovered while building Slice 5 Part 3
 * (trustee-verification-remap.ts): Azure Functions' InvocationModel.getResponse() only
 * serializes `context.extraOutputs.set(queue, value)` calls for queues the INVOKING
 * function's own `app.storageQueue`/`app.http` registration declared in its `extraOutputs`
 * array at setup time -- any other queue name is silently dropped, with no error, because the
 * runtime never even looks at it. Mocking `context.extraOutputs` as a bare `Map` (the existing
 * pattern used elsewhere in this file) cannot catch this: a bare Map has no notion of what a
 * given handler actually registered, so it can't tell a correctly-wired queue from a
 * silently-dropped one. This file instead drives the REAL `setup()` export and asserts against
 * the actual registration Azure Functions would receive.
 */

const storageQueueCalls: Array<
  [name: string, options: { extraOutputs?: unknown[]; handler: unknown }]
> = [];

vi.mock('@azure/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@azure/functions')>();
  return {
    ...actual,
    app: {
      ...actual.app,
      storageQueue: vi.fn(
        (name: string, options: { extraOutputs?: unknown[]; handler: unknown }) => {
          storageQueueCalls.push([name, options]);
        },
      ),
      timer: vi.fn(),
    },
  };
});

describe('sync-trustee-case-appointments extraOutputs registration wiring', () => {
  test('handlePage declares TRUSTEE_APPOINTMENT_EVENT_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_APPOINTMENT_EVENT_QUEUE } = await import('../../../lib/storage-queues');
    const { handlePage, default: syncTrusteeCaseAppointments } =
      await import('./sync-trustee-case-appointments');

    syncTrusteeCaseAppointments.setup();

    const handlePageRegistration = storageQueueCalls.find(
      ([, options]) => options.handler === handlePage,
    );
    expect(handlePageRegistration).toBeDefined();

    const [, options] = handlePageRegistration!;
    // applyResolvedTrustee (via ApiToDataflowsGatewayImpl.queueTrusteeAppointmentEvent) calls
    // context.extraOutputs.set(TRUSTEE_APPOINTMENT_EVENT_QUEUE, ...) whenever a case is
    // auto-matched/soft-closed with the downstream feature flag on. Without this queue declared
    // here, that write is silently dropped by the real Azure Functions runtime.
    expect(options.extraOutputs).toContain(TRUSTEE_APPOINTMENT_EVENT_QUEUE);
  });
});
