import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import LocalStorage from '@/lib/utils/local-storage';
import * as InactiveLogout from '@/login/inactive-logout';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Session Timeout Warning
 *
 * As a CAMS user
 * I want to receive a warning before my session expires
 * So that I can extend my session without losing my work
 */

describe('Feature: Session Timeout Warning', () => {
  const NOW = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;
  const SIXTY_SECONDS = 60 * 1000;
  const TIME_INACTIVE_BEFORE_WARNING = THIRTY_MINUTES - SIXTY_SECONDS; // 29 minutes - user has been inactive this long

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
   * Scenario: User clicks "Stay Logged In" button to extend session
   *
   * Given the user has been inactive for 29 minutes
   * When the warning modal appears
   * And the user clicks the "Stay Logged In" button
   * Then the session should be extended
   * And the timer should be reset
   * And the modal should close
   * And a success toast should appear saying "Your session has been extended"
   */
  test('STEP 1: User clicks "Stay Logged In" button → Session extends + Toast appears', async () => {
    // ARRANGE: Set up test session and render app
    const session = TestSessions.trialAttorney();
    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Mock inactivity - user has been inactive for 29 minutes (60 seconds until timeout)
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(NOW - TIME_INACTIVE_BEFORE_WARNING);
    vi.spyOn(Date, 'now').mockReturnValue(NOW);

    // ACT: Trigger inactivity check to show modal
    // Wait for React effects to complete (modal ref to be set) before checking inactivity
    await waitFor(() => {
      InactiveLogout.checkForInactivity();
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
    });

    // ASSERT: Modal should have heading
    const heading = screen.getByText(/Session Expiring Soon/i);
    expect(heading).toBeInTheDocument();

    // ASSERT: Modal should have "Stay Logged In" button
    const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
    expect(stayLoggedInButton).toBeInTheDocument();

    // ACT: Click "Stay Logged In" button
    fireEvent.click(stayLoggedInButton);

    // ASSERT: Modal should close (check for is-hidden class)
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toHaveClass('is-hidden');
    });

    // ASSERT: Timer should be reset (setLastInteraction called with current time)
    expect(setLastInteractionSpy).toHaveBeenCalledWith(expect.any(Number));
    const lastCallTime =
      setLastInteractionSpy.mock.calls[setLastInteractionSpy.mock.calls.length - 1][0];
    expect(lastCallTime).toBeGreaterThanOrEqual(NOW);

    // ASSERT: Toast notification should appear
    await waitFor(() => {
      const toast = screen.getByText(/Your session has been extended/i);
      expect(toast).toBeInTheDocument();
    });

    // Cleanup spies
    getLastInteractionSpy.mockRestore();
    setLastInteractionSpy.mockRestore();
  });
});
