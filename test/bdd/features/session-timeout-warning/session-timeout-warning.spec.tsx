import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import LocalStorage from '@/lib/utils/local-storage';
import { AUTH_EXPIRY_WARNING, SESSION_TIMEOUT } from '@/login/session-timer';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { createTestSession } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsRole } from '@common/cams/roles';
import { AuthContext } from '@/login/AuthContext';
import * as OktaLibrary from '@/login/providers/okta/okta-library';
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

describe('Feature: Session Timeout Warning', () => {
  const NOW = Date.now();
  const HEARTBEAT = 5 * 60 * 1000; // 5 minutes - matches okta-library HEARTBEAT constant
  const TIME_INACTIVE = HEARTBEAT + 1000; // User has been inactive for more than the heartbeat interval

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
   * Scenario: Warning modal appears when AUTH_EXPIRY_WARNING event is emitted
   *
   * Given the user's session is about to expire
   * When the AUTH_EXPIRY_WARNING event is dispatched
   * Then a warning modal should appear
   * And it should display "Session Expiring Soon" heading
   * And it should show the warning message
   * And it should have "Stay Logged In" and "Log Out Now" buttons
   */
  test('STEP 1a: Modal appears with warning when AUTH_EXPIRY_WARNING is emitted', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ACT: Emit AUTH_EXPIRY_WARNING event to trigger modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    // ASSERT: Modal should appear
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
      expect(modal).not.toHaveClass('is-hidden');
    });

    // ASSERT: Modal should have correct heading
    const heading = screen.getByText(/Session Expiring Soon/i);
    expect(heading).toBeInTheDocument();

    // ASSERT: Modal should display the warning message with countdown timer
    const messageStart = screen.getByText(/Your session will expire in/i);
    expect(messageStart).toBeInTheDocument();

    // ASSERT: Countdown timer should be present and showing a value
    const countdownTimer = screen.getByTestId('countdown-timer');
    expect(countdownTimer).toBeInTheDocument();
    expect(parseInt(countdownTimer.textContent || '0')).toBeGreaterThan(0);

    // ASSERT: Modal should have "Stay Logged In" button
    const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
    expect(stayLoggedInButton).toBeInTheDocument();

    // ASSERT: Modal should have "Log Out Now" button
    const logOutNowButton = screen.getByRole('button', { name: /Log Out Now/i });
    expect(logOutNowButton).toBeInTheDocument();
  });

  /**
   * Scenario: User extends session by clicking "Stay Logged In"
   *
   * Given the warning modal is displayed
   * When the user clicks the "Stay Logged In" button
   * Then the modal should close
   */
  test('STEP 1b: Clicking "Stay Logged In" closes the modal', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Show the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
      expect(modal).not.toHaveClass('is-hidden');
    });

    // ACT: Click "Stay Logged In" button
    const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
    fireEvent.click(stayLoggedInButton);

    // ASSERT: Modal should close (check for is-hidden class)
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toHaveClass('is-hidden');
    });
  });

  /**
   * Scenario: Inactive timer is reset when user extends session
   *
   * Given the warning modal is displayed
   * When the user clicks the "Stay Logged In" button
   * Then the inactive timer should be reset
   */
  test('STEP 1c: Clicking "Stay Logged In" resets the inactive timer', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Mock inactivity - user has been inactive for more than heartbeat interval
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(NOW - TIME_INACTIVE);

    // ARRANGE: Show the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
    });

    // ACT: Click "Stay Logged In" button
    const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
    fireEvent.click(stayLoggedInButton);

    // ASSERT: Timer should be reset (setLastInteraction called with current time)
    expect(setLastInteractionSpy).toHaveBeenCalledWith(expect.any(Number));
    const lastCallTime =
      setLastInteractionSpy.mock.calls[setLastInteractionSpy.mock.calls.length - 1][0];
    expect(lastCallTime).toBeGreaterThanOrEqual(NOW);

    // Cleanup spies
    getLastInteractionSpy.mockRestore();
    setLastInteractionSpy.mockRestore();
  });

  /**
   * Scenario: Okta token renewal is called when user extends session
   *
   * Given the warning modal is displayed
   * And the AuthContext provides an oktaAuth instance
   * When the user clicks the "Stay Logged In" button
   * Then renewOktaToken should be called with the oktaAuth instance
   */
  test('STEP 1d: Clicking "Stay Logged In" calls renewOktaToken', async () => {
    // ARRANGE: Create a mock oktaAuth instance
    const mockOktaAuth = {} as Partial<OktaAuth>;

    // ARRANGE: Spy on renewOktaToken
    const renewOktaTokenSpy = vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();

    // ARRANGE: Mock the SessionTimeoutManager's useContext call by patching the AuthContext
    // We'll temporarily modify the _currentValue which is React's internal for context
    interface ReactContextInternal {
      _currentValue: unknown;
      _currentValue2: unknown;
    }
    const authContextInternal = AuthContext as unknown as ReactContextInternal;
    const originalValue = authContextInternal._currentValue;
    authContextInternal._currentValue = { oktaAuth: mockOktaAuth };
    authContextInternal._currentValue2 = { oktaAuth: mockOktaAuth }; // For concurrent mode

    try {
      // ARRANGE: Set up test session and render
      const session = createSessionWithExpiry();
      await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
      await waitForAppLoad();

      // ARRANGE: Show the modal
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
      await waitFor(() => {
        const modal = screen.getByTestId('modal-session-timeout-warning');
        expect(modal).toBeInTheDocument();
      });

      // ACT: Click "Stay Logged In" button
      const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
      fireEvent.click(stayLoggedInButton);

      // ASSERT: renewOktaToken should have been called with the mock oktaAuth
      await waitFor(() => {
        expect(renewOktaTokenSpy).toHaveBeenCalledWith(mockOktaAuth);
      });
    } finally {
      // Cleanup: Restore original context value
      authContextInternal._currentValue = originalValue;
      authContextInternal._currentValue2 = originalValue;
      renewOktaTokenSpy.mockRestore();
    }
  });

  /**
   * Scenario: Success message appears after extending session
   *
   * Given the warning modal is displayed
   * When the user clicks the "Stay Logged In" button
   * Then a success toast should appear
   * And it should say "Your session has been extended"
   */
  test('STEP 1e: Success toast appears after extending session', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Show the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
    });

    // ACT: Click "Stay Logged In" button
    const stayLoggedInButton = screen.getByRole('button', { name: /Stay Logged In/i });
    fireEvent.click(stayLoggedInButton);

    // ASSERT: Toast notification should appear
    await waitFor(() => {
      const toast = screen.getByText(/Your session has been extended/i);
      expect(toast).toBeInTheDocument();
    });
  });

  /**
   * Scenario: User logs out by clicking "Log Out Now"
   *
   * Given the warning modal is displayed
   * When the user clicks the "Log Out Now" button
   * Then the user should be logged out
   * And redirected to the logout page
   */
  test('STEP 1f: Clicking "Log Out Now" logs out the user', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ARRANGE: Show the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
    await waitFor(() => {
      const modal = screen.getByTestId('modal-session-timeout-warning');
      expect(modal).toBeInTheDocument();
      expect(modal).not.toHaveClass('is-hidden');
    });

    // ACT: Click "Log Out Now" button
    const logOutNowButton = screen.getByRole('button', { name: /Log Out Now/i });
    fireEvent.click(logOutNowButton);

    // ASSERT: User should be redirected to logout page
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  /**
   * Scenario: Automatic logout when SESSION_TIMEOUT event is emitted
   *
   * Given the user's session has completely timed out due to inactivity
   * When the SESSION_TIMEOUT event is dispatched
   * Then the user should be automatically logged out
   * And redirected to the logout page
   */
  test('STEP 2: Automatic logout when SESSION_TIMEOUT is emitted', async () => {
    // ARRANGE: Set up test session
    const session = createSessionWithExpiry();

    await TestSetup.forUser(session).withMyAssignments([]).renderAt('/my-cases');
    await waitForAppLoad();

    // ACT: Emit SESSION_TIMEOUT event (simulating automatic timeout)
    window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT));

    // ASSERT: User should be redirected to logout page
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });
});
