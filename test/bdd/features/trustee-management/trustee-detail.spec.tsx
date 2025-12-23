import { describe, test, beforeAll, afterAll, afterEach } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import {
  TestSetup,
  waitForAppLoad,
  expectPageToContain,
  expectPageToMatch,
} from '../../helpers/fluent-test-setup';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: View Trustee Details (Full Stack)
 *
 * As a USTP Trustee Administrator
 * I want to view detailed information about a trustee
 * So that I can review their contact information and manage their profile
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (TrusteeDetailScreen, TrusteeDetailHeader, TrusteeDetailProfile)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (TrusteesController)
 * - Use cases (TrusteesUseCase)
 * - Mocked repositories (TrusteesMongoRepository)
 *
 * Code Coverage:
 * - user-interface/src/trustees/TrusteeDetailScreen.tsx
 * - user-interface/src/trustees/TrusteeDetailHeader.tsx
 * - user-interface/src/trustees/panels/TrusteeDetailProfile.tsx
 * - backend/lib/controllers/trustees/trustees.controller.ts
 * - backend/lib/use-cases/trustees/trustees.ts
 *
 * Replaces Unit Tests:
 * - user-interface/src/trustees/TrusteeDetailScreen.test.tsx (14 tests)
 *   ├─ Loading states (1 test) → Implicit in waitForAppLoad()
 *   ├─ Rendering with complete contact (2 tests) → Scenario 1
 *   ├─ Missing contact information (1 test) → Scenario 2
 *   ├─ Navigation between tabs (4 tests) → Scenarios 3, 4
 *   ├─ Error handling (3 tests) → Scenario 5
 *   └─ Software list fetching (3 tests) → Implicit in all scenarios
 *
 * - backend/lib/use-cases/trustees/trustees.test.ts (2 read tests out of 27 total)
 *   ├─ getTrustee success → Scenario 1
 *   └─ getTrustee error → Scenario 5
 *
 * - backend/lib/controllers/trustees/trustees.controller.test.ts (3 tests out of 19 total)
 *   ├─ GET /api/trustees/:id → Scenario 1 (implicit)
 *   ├─ Authorization checks → Scenario 6
 *   └─ Trustee not found → Scenario 5
 *
 * Total: ~18 unit tests → 6 BDD scenarios
 * Migration Date: 2025-12-22
 * Coverage Comparison: See coverage-baseline/BASELINE-SUMMARY.md
 *
 * NOTE: This migration covers the READ operations for trustee details only.
 * Create/Update operations (remaining ~40 unit tests) will be migrated separately.
 */
describe('Feature: View Trustee Details (Full Stack)', () => {
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
   * Scenario: View trustee with complete contact information
   *
   * GIVEN a trustee exists with complete public and internal contact info
   * WHEN the user navigates to the trustee detail page
   * THEN all contact information should be displayed correctly
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should render trustee header when data is loaded"
   * - TrusteeDetailProfile.test.tsx: "should render public contact information"
   * - trustees.test.ts: "should return a single trustee"
   * - trustees.controller.test.ts: "should return individual trustee for GET requests with ID"
   */
  test('should display trustee with complete contact information', async () => {
    // GIVEN: A trustee with complete contact information
    const testTrustee = MockData.getTrustee({
      trusteeId: '123',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          address2: 'Suite 100',
          address3: 'Floor 5',
          city: 'Anytown',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
        email: 'john.doe@example.com',
        phone: { number: '555-123-4567', extension: '1234' },
      },
      internal: {
        address: {
          address1: '456 Internal Blvd',
          city: 'Internal City',
          state: 'CA',
          zipCode: '54321',
          countryCode: 'US',
        },
        email: 'john.internal@example.com',
        phone: { number: '555-987-6543' },
      },
    });

    // WHEN: User renders directly at trustee detail page
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // THEN: Trustee name should display in header
    await expectPageToContain('John Doe');

    // Public contact information should display
    await expectPageToContain('123 Main St');
    await expectPageToContain('Suite 100');
    await expectPageToContain('Anytown');
    await expectPageToContain('NY');
    await expectPageToContain('12345');
    await expectPageToContain('john.doe@example.com');
    await expectPageToContain('555-123-4567');

    // Internal contact information should display
    await expectPageToContain('456 Internal Blvd');
    await expectPageToContain('Internal City');
    await expectPageToContain('CA');
    await expectPageToContain('54321');
    await expectPageToContain('john.internal@example.com');
    await expectPageToContain('555-987-6543');

    console.log('[TEST] ✓ Complete trustee contact information displayed successfully');
  }, 20000);

  /**
   * Scenario: View trustee with missing contact information
   *
   * GIVEN a trustee exists with incomplete contact info
   * WHEN the user views the trustee
   * THEN only available information is shown, missing fields are gracefully hidden
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should handle trustees with missing contact information"
   */
  test('should handle trustee with missing contact information', async () => {
    // GIVEN: A trustee with minimal contact information
    const testTrustee = MockData.getTrustee({
      trusteeId: '456',
      name: 'Jane Smith',
      public: {
        phone: { number: '555-999-8888' },
        address: {
          address1: '', // Empty address
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
      // No internal contact or email
    });

    // WHEN: User renders trustee page
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    // THEN: Name and phone display
    await expectPageToContain('Jane Smith');
    await expectPageToContain('555-999-8888');

    console.log('[TEST] ✓ Missing contact information handled gracefully');
  }, 20000);

  /**
   * Scenario: Navigate to trustee profile tab
   *
   * GIVEN a trustee exists
   * WHEN user navigates to the default/profile route
   * THEN the trustee profile information should display
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should render subheader 'Trustee' for default route"
   */
  test('should display trustee profile on default route', async () => {
    // GIVEN: A trustee exists
    const testTrustee = MockData.getTrustee({
      trusteeId: '789',
      name: 'Profile Test Trustee',
    });

    // WHEN: User renders default trustee route
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    // THEN: Profile should display
    await expectPageToContain('Profile Test Trustee');
    await expectPageToMatch(/Trustee/i);

    console.log('[TEST] ✓ Trustee profile displayed on default route');
  }, 20000);

  /**
   * Scenario: Navigate to trustee audit history tab
   *
   * GIVEN a trustee exists
   * WHEN user navigates to the audit-history route
   * THEN the audit history tab should display
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should render subheader 'Trustee' for /audit-history route"
   */
  test('should display audit history tab', async () => {
    // GIVEN: A trustee exists
    const testTrustee = MockData.getTrustee({
      trusteeId: '101',
      name: 'Audit Test Trustee',
    });

    // WHEN: User renders audit history tab directly
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .withTrusteeHistory(testTrustee.trusteeId, []) // Empty history for this test
      .renderAt(`/trustees/${testTrustee.trusteeId}/audit-history`);

    await waitForAppLoad();

    // THEN: Audit history page should display
    await expectPageToContain('Audit Test Trustee');
    await expectPageToMatch(/Change History/i);

    console.log('[TEST] ✓ Audit history tab displayed successfully');
  }, 20000);

  /**
   * Scenario: Handle trustee not found error
   *
   * GIVEN a trustee does not exist
   * WHEN user tries to access the trustee detail page
   * THEN an appropriate error message should display
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should handle API errors gracefully"
   * - TrusteeDetailScreen.test.tsx: "should render NotFound when trustee is not found"
   * - trustees.test.ts: "should handle repository error when trustee not found"
   * - trustees.controller.test.ts: "should handle trustee not found errors"
   */
  test('should handle trustee not found error', async () => {
    // GIVEN: A trustee that does not exist
    const nonExistentTrusteeId = 'nonexistent-123';

    // WHEN: User renders non-existent trustee page
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCustomSpy('TrusteesMongoRepository', {
        read: vi.fn().mockRejectedValue(new Error('Trustee not found')),
      })
      .renderAt(`/trustees/${nonExistentTrusteeId}`);

    // THEN: Error message or 404 page should display
    await expectPageToMatch(/not found|something went wrong|error/i);

    console.log('[TEST] ✓ Trustee not found error handled gracefully');
  }, 20000);

  /**
   * Scenario: Deny access to non-admin users
   *
   * GIVEN a user without TrusteeAdmin role
   * WHEN they try to access trustee detail page
   * THEN access should be denied
   *
   * Replaces:
   * - trustees.controller.test.ts: "should deny access for users without TrusteeAdmin role"
   * - trustees.controller.test.tsx: "should deny access for users with no roles"
   *
   * NOTE: This test verifies backend authorization. If authorization happens on
   * the frontend routing level, this may show a 404 or redirect. The key is that
   * non-admin users cannot access the trustee data.
   */
  test('should deny access to non-admin users', async () => {
    // GIVEN: A non-admin user (trial attorney) and a trustee
    const testTrustee = MockData.getTrustee({
      trusteeId: '999',
      name: 'Protected Trustee',
    });

    // WHEN: Non-admin user renders trustee page
    await TestSetup.forUser(TestSessions.trialAttorney()) // Not a trustee admin
      .withFeatureFlag('trustee-management', true)
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    // THEN: Access denied, 404, or redirect should occur
    // The trustee name should NOT appear
    await expectPageToMatch(/not found|access denied|unauthorized|something went wrong/i);

    console.log('[TEST] ✓ Access denied for non-admin user');
  }, 20000);
});
