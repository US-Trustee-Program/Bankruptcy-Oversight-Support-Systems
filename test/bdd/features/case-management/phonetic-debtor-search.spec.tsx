import { describe, expect, beforeAll, afterAll, afterEach, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import MockData from '@common/cams/test-utilities/mock-data';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Debtor Name Search (UI Behavior)
 *
 * As a USTP staff member
 * I want to search for cases by debtor name
 * So that I can find cases quickly
 *
 * This test suite validates UI behavior when the debtor name search feature is toggled.
 * The search implementation details (phonetic, fuzzy, exact, etc.) are tested in backend unit tests.
 */
describe('Feature: Debtor Name Search (UI)', () => {
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
   * Helper function to create mock case summary
   */
  function createMockCase(caseId: string, debtorName: string) {
    return MockData.getCaseSummary({
      override: {
        caseId,
        caseTitle: debtorName,
        debtor: { name: debtorName },
      },
    });
  }

  /**
   * Scenario: Search returns results
   *
   * GIVEN debtor name search is enabled
   * WHEN I search by debtor name
   * AND the backend returns matching cases
   * THEN I should see the search results displayed
   */
  test('should display search results when matches are found', async () => {
    // GIVEN: Mock results from backend
    const case1 = createMockCase('24-00001', 'Michael Johnson');
    const case2 = createMockCase('24-00002', 'Mike Johnson');

    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('phonetic-search-enabled', true)
      .withSearchResults([case1, case2])
      .renderAt('/');

    await waitForAppLoad();

    // Navigate to Case Search
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    await userEvent.click(caseSearchLink);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Case Search');
    });

    // WHEN: Search by debtor name
    const searchInput = await screen.findByLabelText(/debtor name/i);
    await userEvent.type(searchInput, 'Mike');

    const searchButton = await screen.findByRole('button', { name: /search/i });
    await userEvent.click(searchButton);

    // THEN: Should see search results
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('24-00001');
        expect(body).toContain('Michael Johnson');
        expect(body).toContain('24-00002');
        expect(body).toContain('Mike Johnson');
      },
      { timeout: 10000 },
    );
  }, 30000);

  /**
   * Scenario: No results found
   *
   * GIVEN debtor name search is enabled
   * WHEN I search by debtor name
   * AND the backend returns no matching cases
   * THEN I should see "No cases found" message
   */
  test('should display "No cases found" when no matches exist', async () => {
    // GIVEN: Empty results
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('phonetic-search-enabled', true)
      .withSearchResults([])
      .renderAt('/');

    await waitForAppLoad();

    // Navigate to Case Search
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    await userEvent.click(caseSearchLink);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Case Search');
    });

    // WHEN: Search by debtor name
    const searchInput = await screen.findByLabelText(/debtor name/i);
    await userEvent.type(searchInput, 'NonExistentName');

    const searchButton = await screen.findByRole('button', { name: /search/i });
    await userEvent.click(searchButton);

    // THEN: Should see "No cases found" message
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('No cases found');
      },
      { timeout: 10000 },
    );
  }, 30000);

  /**
   * Scenario: API error
   *
   * GIVEN debtor name search is enabled
   * WHEN I search by debtor name
   * AND the backend API returns an error
   * THEN I should see an error message
   */
  test('should display error message when API fails', async () => {
    // GIVEN: API will error
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('phonetic-search-enabled', true)
      .withCustomSpy('CasesMongoRepository', {
        searchCases: async () => {
          throw new Error('Database connection failed');
        },
      })
      .renderAt('/');

    await waitForAppLoad();

    // Navigate to Case Search
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    await userEvent.click(caseSearchLink);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Case Search');
    });

    // WHEN: Search by debtor name
    const searchInput = await screen.findByLabelText(/debtor name/i);
    await userEvent.type(searchInput, 'TestName');

    const searchButton = await screen.findByRole('button', { name: /search/i });
    await userEvent.click(searchButton);

    // THEN: Should see error message
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        const hasError =
          body.includes('error') ||
          body.includes('failed') ||
          body.includes('Unable') ||
          body.includes('try again');
        expect(hasError).toBe(true);
      },
      { timeout: 10000 },
    );
  }, 30000);

  /**
   * Scenario: Feature disabled
   *
   * GIVEN debtor name search feature is disabled
   * WHEN I navigate to the Case Search page
   * THEN the debtor name field should NOT be visible
   */
  test('should hide debtor name field when feature is disabled', async () => {
    // GIVEN: Feature disabled
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withFeatureFlag('phonetic-search-enabled', false)
      .renderAt('/');

    await waitForAppLoad();

    // WHEN: Navigate to Case Search
    const caseSearchLink = await screen.findByRole('link', { name: /case search/i });
    await userEvent.click(caseSearchLink);

    await waitFor(() => {
      expect(document.body.textContent).toContain('Case Search');
    });

    // THEN: Debtor name field should not be present
    const debtorNameInput = screen.queryByLabelText(/debtor name/i);
    expect(debtorNameInput).toBeNull();
  }, 30000);
});
