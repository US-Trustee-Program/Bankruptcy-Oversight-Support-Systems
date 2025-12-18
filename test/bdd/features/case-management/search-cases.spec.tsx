import { describe, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Search Cases (Full Stack)
 *
 * As a USTP user
 * I want to search for bankruptcy cases by criteria
 * So that I can find relevant cases to review
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (CaseSearch)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (CasesController)
 * - Use cases (CaseManagement)
 * - Mocked gateways/repositories (spied production code)
 *
 * Code Coverage:
 * - user-interface/src/case-search/
 * - backend/lib/controllers/cases/
 * - backend/lib/use-cases/cases/
 */
describe('Feature: Search Cases (Full Stack)', () => {
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
   * Scenario: Basic app rendering
   *
   * GIVEN I am logged in
   * WHEN the app loads
   * THEN I should see the home page
   */
  test('should render the app successfully', async () => {
    // GIVEN/WHEN: User loads the app
    await TestSetup.forUser(TestSessions.caseAssignmentManager()).renderAt('/');

    await waitForAppLoad();

    // THEN: App should be rendered
    const body = document.body.textContent || '';
    expect(body.length).toBeGreaterThan(200);

    console.log('[TEST] ✓ App rendered and finished loading');
  });

  /**
   * Scenario: User searches for cases and sees results
   *
   * GIVEN I am logged in as a case assignment manager
   * WHEN I navigate to the search tab
   * AND I enter search criteria
   * AND I click the search button
   * THEN I should see matching case summaries in the results table
   */
  test('should search for cases and display results', async () => {
    // GIVEN: Mock search results
    const mockCases = Array.from({ length: 5 }, (_, index) =>
      MockData.getCaseSummary({
        override: {
          caseId: `081-23-${10000 + index}`,
          caseTitle: `Test Case ${index + 1}`,
          chapter: '15',
        },
      }),
    );

    console.log('[TEST] Created mockCases:', mockCases.length, 'cases');

    // Set up search results
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withSearchResults(mockCases)
      .renderAt('/');

    await waitForAppLoad();

    console.log('[TEST] ✓ App finished loading');

    // WHEN: Navigate to Case Search tab
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    console.log('[TEST] Found "Case Search" link, clicking...');
    await userEvent.click(caseSearchLink);

    // Wait for search page
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('Case Search');
      },
      { timeout: 5000 },
    );

    console.log('[TEST] ✓ On Case Search page');

    // Enter a case number to search for (simpler than combobox interaction)
    const caseNumberInput = await screen.findByLabelText(/case number/i);
    console.log('[TEST] Found case number input, typing...');
    await userEvent.type(caseNumberInput, '081-23-10000');

    console.log('[TEST] ✓ Entered case number');

    // Click search button
    const searchButton = await screen.findByRole('button', { name: /search/i });
    console.log('[TEST] Found search button, clicking...');
    await userEvent.click(searchButton);

    console.log('[TEST] ✓ Search executed');

    // THEN: Should see results
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        console.log('[TEST] Checking for results...');

        // Should see the first case in results
        expect(body).toContain('Test Case 1');
      },
      { timeout: 10000 },
    );

    console.log('[TEST] ✓ Results displayed');
  }, 30000);

  /**
   * Scenario: No results found
   *
   * GIVEN no matching cases exist for a specific search
   * WHEN I search with criteria that yield no results
   * THEN I should see a no results message
   */
  test('should display no results message when search returns empty', async () => {
    // GIVEN: Empty search results
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withSearchResults([])
      .renderAt('/');

    await waitForAppLoad();

    // WHEN: Navigate to search
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    await userEvent.click(caseSearchLink);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Case Search');
    });

    // Enter a case number to make search valid (so button is enabled)
    const caseNumberInput = await screen.findByLabelText(/case number/i);
    await userEvent.type(caseNumberInput, '999-99-99999');

    console.log('[TEST] Entered case number to enable search');

    // Now click search
    const searchButton = await screen.findByRole('button', { name: /search/i });
    await userEvent.click(searchButton);

    console.log('[TEST] Clicked search button');

    // THEN: Should see "No cases found" message (from SearchResults component)
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        console.log('[TEST] Checking for "No cases found" message...');
        expect(body).toContain('No cases found');
      },
      { timeout: 10000 },
    );

    console.log('[TEST] ✓ No results message displayed');
  }, 30000);
});
