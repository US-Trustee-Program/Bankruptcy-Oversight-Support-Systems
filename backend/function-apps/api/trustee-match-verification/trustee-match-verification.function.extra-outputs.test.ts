import { describe, test, beforeEach } from 'vitest';
import { assertExtraOutputsRegistered } from '../../../lib/testing/assert-extra-outputs-registered';

/**
 * Regression coverage for the same extraOutputs wiring-gap bug class fixed in
 * sync-trustee-case-appointments.extra-outputs.test.ts and
 * trustee-verification-remap.extra-outputs.test.ts — see assertExtraOutputsRegistered's doc
 * comment for the underlying Azure Functions mechanism. Unlike those two dataflow modules, this
 * one registers via a top-level `app.http(...)` call (an import-time side effect, no explicit
 * `setup()`), and only declares its extraOutputs conditionally on
 * `process.env.AzureWebJobsDataflowsStorage` being set.
 */
describe('trustee-match-verification.function extraOutputs registration wiring', () => {
  beforeEach(() => {
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('handler declares TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE } = await import('../../../lib/storage-queues');

    // The controller's approveVerification use case (via
    // ApiToDataflowsGatewayImpl.queueTrusteeVerificationRemap) calls
    // context.extraOutputs.set(TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE, ...) for every approved
    // verification. Without this queue declared in the function's own registration, that write
    // is silently dropped by the real Azure Functions runtime.
    await assertExtraOutputsRegistered(
      () => import('./trustee-match-verification.function'),
      'default',
      [TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE],
    );
  });
});
