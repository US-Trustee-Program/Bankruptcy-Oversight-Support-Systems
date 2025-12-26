import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import LocalStorage from '@/lib/utils/local-storage';
import * as InactiveLogout from '@/login/inactive-logout';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { createTestSession, createTestAuthToken } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsRole } from '@common/cams/roles';
import Api2 from '@/lib/models/api2';
import OktaAuth from '@okta/okta-auth-js';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Session Timeout Warning
 *
 * As a CAMS user
 * I want to receive a warning before my session expires
 * So that I can extend my session without losing my work
 */

describe.only('Feature: Session Timeout Warning', () => {
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
   * Helper function to create a test session with custom JWT expiry
   * @param expiryInSeconds - Optional Unix timestamp in seconds for when the JWT should expire
   */
  function createSessionWithExpiry(expiryInSeconds?: number) {
    return createTestSession([CamsRole.TrialAttorney], expiryInSeconds);
  }

  /**
   * Setup Okta Auth spies to return renewed tokens with custom expiry
   * This mocks the renewOktaToken flow in okta-library.ts
   */
  function setupOktaRenewalSpies(renewedExpiryInSeconds: number) {
    const roles = [CamsRole.TrialAttorney];

    // Generate a real JWT with the renewed expiry time using createTestAuthToken
    // This creates a properly signed JWT that can be naturally decoded
    const renewedAccessToken = createTestAuthToken(roles, renewedExpiryInSeconds);

    const mockUser = {
      sub: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
    };

    // Spy on getOrRenewAccessToken to return the renewed JWT
    vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken').mockResolvedValue(renewedAccessToken);

    // Spy on getUser to return user info
    vi.spyOn(OktaAuth.prototype, 'getUser').mockResolvedValue(mockUser);

    // No need to mock token.decode - it will naturally decode the real JWT from createTestAuthToken

    // Spy on Api2.getMe to return the updated session with renewed expiry
    const renewedSession = createSessionWithExpiry(renewedExpiryInSeconds);
    vi.spyOn(Api2, 'getMe').mockResolvedValue({ data: renewedSession });
  }

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
    // ARRANGE: Use fake timers to control time-dependent interactions
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    // ARRANGE: Set up test session with custom JWT expiry (expires 60 seconds from NOW)
    const expiryInSeconds = Math.floor(NOW / 1000) + 60; // Expires in 60 seconds from NOW
    const session = createSessionWithExpiry(expiryInSeconds);

    // ARRANGE: Setup Okta renewal to return a token that expires in 1 hour after renewal
    const renewedExpiryInSeconds = Math.floor(NOW / 1000) + 3600; // Renewed token expires in 1 hour
    setupOktaRenewalSpies(renewedExpiryInSeconds);

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Mock inactivity - user has been inactive for 29 minutes (60 seconds until timeout)
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(NOW - TIME_INACTIVE_BEFORE_WARNING);

    // ACT: Trigger inactivity check to show modal
    // Wait for React effects to complete (modal ref to be set) before checking inactivity
    await waitFor(async () => {
      InactiveLogout.checkForInactivity();
      await vi.runOnlyPendingTimersAsync(); // Flush any pending timers
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

    // Cleanup spies and timers
    getLastInteractionSpy.mockRestore();
    setLastInteractionSpy.mockRestore();
    vi.useRealTimers();
  });
});
