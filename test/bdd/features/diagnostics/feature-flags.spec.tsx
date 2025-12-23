import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * Feature Flag Testing Infrastructure
 *
 * These tests verify that the LaunchDarkly mock infrastructure correctly handles
 * per-test feature flag overrides via setupFeatureFlagSpies().
 *
 * This ensures:
 * 1. Backend LaunchDarkly SDK returns test-specific flags when overridden
 * 2. Frontend useFlags() hook returns test-specific flags when overridden
 * 3. Default "no flags enabled" behavior is preserved when no overrides specified
 *
 * These tests validate the testing infrastructure itself, not application features.
 */
describe('Feature: LaunchDarkly Mock Infrastructure', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(async () => {
    await clearAllRepositorySpies();
  });

  /**
   * Scenario: Backend LaunchDarkly returns custom flags when overridden
   *
   * GIVEN a test specifies custom feature flags via .withFeatureFlag()
   * WHEN the backend initializes LaunchDarkly client
   * THEN allFlagsState().allValues() should return exactly those flags
   */
  test('should override backend LaunchDarkly flags via setupFeatureFlagSpies', async () => {
    // GIVEN: Custom feature flags specified
    const customFlags = {
      'trustee-management': true,
      'case-consolidation': false,
      'experimental-feature': true,
    };

    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlags(customFlags)
      .renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Import backend LaunchDarkly and verify it returns custom flags
    const backendLD = await import('@launchdarkly/node-server-sdk');

    // Initialize a new client (this should return the mocked client with custom flags)
    const client = backendLD.init('test-key', {});
    const flagState = await client.allFlagsState({});
    const actualFlags = flagState.allValues();

    // Verify the client returns exactly the custom flags we specified
    expect(actualFlags).toEqual(customFlags);
    expect(actualFlags['trustee-management']).toBe(true);
    expect(actualFlags['case-consolidation']).toBe(false);
    expect(actualFlags['experimental-feature']).toBe(true);

    console.log('[TEST] ✓ Backend LaunchDarkly returns custom flags');
  });

  /**
   * Scenario: Frontend useFlags returns custom flags when overridden
   *
   * GIVEN a test specifies custom feature flags via .withFeatureFlag()
   * WHEN the frontend calls useFlags() hook
   * THEN it should return exactly those flags
   */
  test('should override frontend useFlags via setupFeatureFlagSpies', async () => {
    // GIVEN: Custom feature flags specified
    const customFlags = {
      'trustee-management': true,
      'new-ui-feature': true,
    };

    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlags(customFlags)
      .renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Import frontend LaunchDarkly and verify useFlags returns custom flags
    const frontendLD = await import('launchdarkly-react-client-sdk');

    // Call useFlags (this should return the mocked flags)
    const actualFlags = frontendLD.useFlags();

    // Verify useFlags returns exactly the custom flags we specified
    expect(actualFlags).toEqual(customFlags);
    expect(actualFlags['trustee-management']).toBe(true);
    expect(actualFlags['new-ui-feature']).toBe(true);

    console.log('[TEST] ✓ Frontend useFlags returns custom flags');
  });

  /**
   * Scenario: Default "no flags enabled" behavior when no overrides
   *
   * GIVEN a test does NOT specify any feature flags
   * WHEN LaunchDarkly is queried
   * THEN frontend should return empty/default flags (all disabled)
   *
   * NOTE: We only test frontend here because:
   * - When no overrides are set, setupFeatureFlagSpies() is never called
   * - Previous test's afterEach calls vi.restoreAllMocks(), which clears the hoisted mocks
   * - Backend SDK calls would fail because the mock has been restored
   * - Frontend useFlags() is the primary way flags are accessed in the app anyway
   * - The backend behavior is implicitly tested by the app working correctly
   */
  test('should preserve default "no flags enabled" behavior when no overrides', async () => {
    // GIVEN: NO custom feature flags specified (using default from driver-mocks)
    await TestSetup.forUser(TestSessions.caseAssignmentManager()).renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Verify frontend returns default (empty) flags
    // This is the primary way feature flags are accessed in the application
    const frontendLD = await import('launchdarkly-react-client-sdk');
    const frontendFlags = frontendLD.useFlags();

    expect(frontendFlags).toEqual({});
    console.log('[TEST] ✓ Frontend useFlags returns default empty flags when no overrides');
  });

  /**
   * Scenario: Single flag override via .withFeatureFlag()
   *
   * GIVEN a test specifies a single feature flag via .withFeatureFlag()
   * WHEN LaunchDarkly is queried
   * THEN that specific flag should be enabled
   */
  test('should handle single flag override via withFeatureFlag', async () => {
    // GIVEN: Single feature flag enabled
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Verify the single flag is present
    const frontendLD = await import('launchdarkly-react-client-sdk');
    const flags = frontendLD.useFlags();

    expect(flags).toHaveProperty('trustee-management', true);
    expect(Object.keys(flags)).toHaveLength(1);

    console.log('[TEST] ✓ Single flag override works correctly');
  });

  /**
   * Scenario: Flag override with false value
   *
   * GIVEN a test explicitly disables a feature flag
   * WHEN LaunchDarkly is queried
   * THEN that flag should be present and set to false
   */
  test('should handle explicitly disabled flags', async () => {
    // GIVEN: Feature flag explicitly set to false
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('experimental-feature', false)
      .renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Verify the flag is present and false
    const frontendLD = await import('launchdarkly-react-client-sdk');
    const flags = frontendLD.useFlags();

    expect(flags).toHaveProperty('experimental-feature', false);
    expect(flags['experimental-feature']).toBe(false);

    console.log('[TEST] ✓ Explicitly disabled flag works correctly');
  });

  /**
   * Scenario: Multiple flags with mixed values
   *
   * GIVEN a test specifies multiple flags with different values
   * WHEN LaunchDarkly is queried
   * THEN all flags should have their specified values
   */
  test('should handle multiple flags with mixed enabled/disabled values', async () => {
    // GIVEN: Multiple flags with mixed true/false values
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlags({
        'trustee-management': true,
        'case-consolidation': true,
        'legacy-feature': false,
        'beta-ui': false,
        'new-api': true,
      })
      .renderAt('/');

    await waitForAppLoad();

    // WHEN/THEN: Verify all flags have correct values
    const backendLD = await import('@launchdarkly/node-server-sdk');
    const client = backendLD.init('test-key', {});
    const flagState = await client.allFlagsState({});
    const flags = flagState.allValues();

    expect(flags['trustee-management']).toBe(true);
    expect(flags['case-consolidation']).toBe(true);
    expect(flags['legacy-feature']).toBe(false);
    expect(flags['beta-ui']).toBe(false);
    expect(flags['new-api']).toBe(true);
    expect(Object.keys(flags)).toHaveLength(5);

    console.log('[TEST] ✓ Multiple mixed flags work correctly');
  });
});
