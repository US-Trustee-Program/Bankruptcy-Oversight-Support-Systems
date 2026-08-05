import { describe, test } from 'vitest';
import { assertExtraOutputsRegistered } from '../../../lib/testing/assert-extra-outputs-registered';

/**
 * Regression coverage for a class of bug discovered while building Slice 5 Part 3
 * (trustee-verification-remap.ts): Azure Functions' InvocationModel.getResponse() only
 * serializes `context.extraOutputs.set(queue, value)` calls for queues the INVOKING
 * function's own `app.storageQueue`/`app.http` registration declared in its `extraOutputs`
 * array at setup time -- any other queue name is silently dropped, with no error. Mocking
 * `context.extraOutputs` as a bare `Map` (the existing pattern used elsewhere in this file)
 * cannot catch this: a bare Map has no notion of what a given handler actually registered, so
 * it can't tell a correctly-wired queue from a silently-dropped one. See
 * assertExtraOutputsRegistered's doc comment for how this file instead drives the real setup()
 * export and asserts against the actual Azure Functions registration.
 */
describe('sync-trustee-case-appointments extraOutputs registration wiring', () => {
  test('handlePage declares TRUSTEE_APPOINTMENT_EVENT_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_APPOINTMENT_EVENT_QUEUE } = await import('../../../lib/storage-queues');

    // applyResolvedTrustee (via ApiToDataflowsGatewayImpl.queueTrusteeAppointmentEvent) calls
    // context.extraOutputs.set(TRUSTEE_APPOINTMENT_EVENT_QUEUE, ...) whenever a case is
    // auto-matched/soft-closed with the downstream feature flag on. Without this queue declared
    // in handlePage's own registration, that write is silently dropped by the real Azure
    // Functions runtime.
    await assertExtraOutputsRegistered(
      () => import('./sync-trustee-case-appointments'),
      'handlePage',
      [TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    );
  });
});
