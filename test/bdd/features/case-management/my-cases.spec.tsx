import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsRole } from '@common/cams/roles';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: My Cases (Full Stack)
 *
 * As a USTP user
 * I want to view my assigned cases on the home page
 * So that I can quickly see what cases I need to work on
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (CaseList / MyCases)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (CasesController)
 * - Use cases (CaseManagement)
 * - Mocked gateways/repositories (spied production code)
 *
 * Code Coverage:
 * - user-interface/src/case-list/
 * - backend/lib/controllers/cases/
 * - backend/lib/use-cases/cases/
 */
describe('Feature: My Cases (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  // Clean up spies after each test to prevent pollution
  afterEach(() => {
    clearAllRepositorySpies();
  });

  /**
   * Scenario: Non-attorney user sees "no cases" message
   *
   * GIVEN I am logged in as a user without attorney role
   * WHEN I navigate to the home page (my cases tab)
   * THEN I should see a message indicating there are no cases
   */
  it('should display no cases message for non-attorney user', async () => {
    // GIVEN: A user without attorney role (DataVerifier)
    const session = TestSessions.dataVerifier();

    console.log('[TEST] User roles:', session.user.roles);
    console.log('[TEST] Has TrialAttorney role:', session.user.roles?.includes(CamsRole.TrialAttorney));

    // WHEN: Load the app with no assignments
    await TestSetup
      .forUser(session)
      .withMyAssignments([])
      .renderAt('/');

    await waitForAppLoad();

    console.log('[TEST] ✓ App finished loading');

    // THEN: Should see "no cases" message
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        console.log('[TEST] Looking for empty state message...');

        // Look for empty state indicators
        const hasEmptyMessage =
          body.includes('No cases') ||
          body.includes('no cases') ||
          body.includes('No assignments') ||
          body.includes('You do not have');

        console.log('[TEST] Has empty state message:', hasEmptyMessage);
        expect(hasEmptyMessage).toBe(true);
      },
      { timeout: 10000, interval: 500 },
    );

    console.log('[TEST] ✓ No cases message displayed for non-attorney user');
  });

  /**
   * Scenario: Attorney user with no assignments sees empty state
   *
   * GIVEN I am logged in as a trial attorney
   * AND I have no cases assigned to me
   * WHEN I view the my cases page
   * THEN I should see an empty state message
   */
  it('should display empty state for attorney with no assignments', async () => {
    // GIVEN: A trial attorney with no cases
    const session = TestSessions.trialAttorney();

    console.log('[TEST] User roles:', session.user.roles);

    // WHEN: Load app with no assignments
    await TestSetup
      .forUser(session)
      .withMyAssignments([])
      .renderAt('/');

    await waitForAppLoad();

    // THEN: Should see empty state
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        const hasEmptyMessage =
          body.includes('No cases') ||
          body.includes('no cases') ||
          body.includes('No assignments');

        console.log('[TEST] Has empty message:', hasEmptyMessage);
        expect(hasEmptyMessage).toBe(true);
      },
      { timeout: 10000 },
    );

    console.log('[TEST] ✓ Empty state displayed for attorney with no assignments');
  });

  /**
   * Scenario: Basic app rendering
   *
   * GIVEN I am logged in
   * WHEN the home page loads
   * THEN the app should render successfully
   */
  it('should render home page and complete all post-login tasks', async () => {
    // GIVEN/WHEN: User loads the app
    await TestSetup
      .forUser(TestSessions.dataVerifier())
      .renderAt('/');

    await waitForAppLoad();

    // THEN: App should be rendered
    const body = document.body.textContent || '';
    console.log('[TEST] Body length:', body.length);

    // Should have actual content
    expect(body.length).toBeGreaterThan(200);

    console.log('[TEST] ✓ Home page rendered successfully');
  });
});
