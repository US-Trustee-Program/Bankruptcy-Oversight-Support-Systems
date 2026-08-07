import { describe, test } from 'vitest';
import { assertExtraOutputsRegistered } from '../../lib/testing/assert-extra-outputs-registered';

/**
 * Regression coverage for the same extraOutputs wiring-gap bug class fixed in
 * sync-trustee-case-appointments.extra-outputs.test.ts — see assertExtraOutputsRegistered's
 * doc comment for the underlying Azure Functions mechanism.
 */
describe('trustee-verification-remap extraOutputs registration wiring', () => {
  test('handleRemap declares TRUSTEE_APPOINTMENT_EVENT_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_APPOINTMENT_EVENT_QUEUE } = await import('../../lib/storage-queues');

    // remapSurrogateAppointment (via ApiToDataflowsGatewayImpl.queueTrusteeAppointmentEvent)
    // calls context.extraOutputs.set(TRUSTEE_APPOINTMENT_EVENT_QUEUE, ...) for every remapped
    // case when the downstream feature flag is on. Without this queue declared in handleRemap's
    // own registration, that write is silently dropped by the real Azure Functions runtime.
    await assertExtraOutputsRegistered(
      () => import('./trustee-verification-remap'),
      'handleRemap',
      [TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    );
  });
});
