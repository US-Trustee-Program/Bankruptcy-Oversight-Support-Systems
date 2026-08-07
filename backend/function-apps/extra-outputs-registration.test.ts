import { beforeEach, describe, test, vi } from 'vitest';
import { assertExtraOutputsRegistered } from '../lib/testing/assert-extra-outputs-registered';

/**
 * Regression coverage for a class of bug discovered while building Slice 5 Part 3
 * (trustee-verification-remap.ts): Azure Functions' InvocationModel.getResponse() only
 * serializes `context.extraOutputs.set(queue, value)` calls for queues the INVOKING
 * function's own `app.storageQueue`/`app.http` registration declared in its `extraOutputs`
 * array at setup time -- any other queue name is silently dropped, with no error. Mocking
 * `context.extraOutputs` as a bare `Map` (the pattern used elsewhere in these modules' own
 * test files) cannot catch this: a bare Map has no notion of what a given handler actually
 * registered, so it can't tell a correctly-wired queue from a silently-dropped one. See
 * assertExtraOutputsRegistered's doc comment for how it instead drives the real setup()
 * export and asserts against the actual Azure Functions registration.
 *
 * Consolidated into one file (was three) so the `vi.doMock('@azure/functions', ...)` +
 * dynamic-import + `vi.resetModules()` cost -- which forces a full re-transform/re-eval of
 * each handler's dependency graph -- is paid once per handler in a single worker instead of
 * once per file across three separate workers.
 *
 * Each test's `await import('../lib/storage-queues')` must stay inside the test body, not
 * hoisted to a shared top-level import: assertExtraOutputsRegistered calls vi.resetModules()
 * in its finally block after every test, so a hoisted import would go stale after the first
 * test and no longer match (by reference) the queue object the next handler's own transitive
 * import of storage-queues.ts produces.
 */
describe('extraOutputs registration wiring', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  test('sync-trustee-case-appointments handlePage declares TRUSTEE_APPOINTMENT_EVENT_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_APPOINTMENT_EVENT_QUEUE } = await import('../lib/storage-queues');

    // applyResolvedTrustee (via ApiToDataflowsGatewayImpl.queueTrusteeAppointmentEvent) calls
    // context.extraOutputs.set(TRUSTEE_APPOINTMENT_EVENT_QUEUE, ...) whenever a case is
    // auto-matched/soft-closed with the downstream feature flag on. Without this queue declared
    // in handlePage's own registration, that write is silently dropped by the real Azure
    // Functions runtime.
    await assertExtraOutputsRegistered(
      () => import('./dataflows/import/sync-trustee-case-appointments'),
      'handlePage',
      [TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    );
  });

  test('trustee-verification-remap handleRemap declares TRUSTEE_APPOINTMENT_EVENT_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_APPOINTMENT_EVENT_QUEUE } = await import('../lib/storage-queues');

    // remapSurrogateAppointment (via ApiToDataflowsGatewayImpl.queueTrusteeAppointmentEvent)
    // calls context.extraOutputs.set(TRUSTEE_APPOINTMENT_EVENT_QUEUE, ...) for every remapped
    // case when the downstream feature flag is on. Without this queue declared in handleRemap's
    // own registration, that write is silently dropped by the real Azure Functions runtime.
    await assertExtraOutputsRegistered(
      () => import('./dataflows/trustee-verification-remap'),
      'handleRemap',
      [TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    );
  });

  test('trustee-match-verification.function handler declares TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE in its own extraOutputs', async () => {
    const { TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE } = await import('../lib/storage-queues');

    // The controller's approveVerification use case (via
    // ApiToDataflowsGatewayImpl.queueTrusteeVerificationRemap) calls
    // context.extraOutputs.set(TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE, ...) for every approved
    // verification. Without this queue declared in the function's own registration, that write
    // is silently dropped by the real Azure Functions runtime. The function's app.http(...) call
    // only adds this queue to extraOutputs when AzureWebJobsDataflowsStorage is set at import
    // time (disabled in E2E where the queue extension may be unavailable), so it must be set
    // here before the dynamic import below. Stubbed (not a direct process.env write) so
    // beforeEach's vi.unstubAllEnvs() clears it even if this test throws before completing.
    vi.stubEnv('AzureWebJobsDataflowsStorage', 'DefaultEndpointsProtocol=https://test');
    await assertExtraOutputsRegistered(
      () => import('./api/trustee-match-verification/trustee-match-verification.function'),
      'default',
      [TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE],
    );
  });
});
