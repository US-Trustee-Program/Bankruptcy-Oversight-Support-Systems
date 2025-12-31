import { render, waitFor, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionTimeoutManager from './SessionTimeoutManager';
import {
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
} from '@/login/session-timer';
import * as sessionTimerController from '@/login/session-timer';
import * as oktaLibrary from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';
import { GlobalAlertContext } from '@/App';
import OktaAuth from '@okta/okta-auth-js';
import userEvent from '@testing-library/user-event';

describe('SessionTimeoutManager', () => {
  const mockOktaAuth = {
    getAccessToken: vi.fn(),
    getOrRenewAccessToken: vi.fn(),
  } as unknown as OktaAuth;

  const mockGlobalAlertRef = {
    current: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      clear: vi.fn(),
    },
  };

  const mockAuthContext = {
    oktaAuth: mockOktaAuth,
    login: vi.fn(),
    logout: vi.fn(),
  };

  let logoutSpy: ReturnType<typeof vi.spyOn>;
  let resetLastInteractionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on stateless functions
    logoutSpy = vi.spyOn(sessionTimerController, 'logout').mockImplementation(() => {});
    resetLastInteractionSpy = vi
      .spyOn(sessionTimerController, 'resetLastInteraction')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithContext = () => {
    return render(
      <AuthContext.Provider value={mockAuthContext}>
        <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
          <SessionTimeoutManager />
        </GlobalAlertContext.Provider>
      </AuthContext.Provider>,
    );
  };

  test('should render the SessionTimeoutWarningModal', () => {
    const { getByTestId } = renderWithContext();

    expect(getByTestId('modal-session-timeout-warning')).toBeInTheDocument();
  });

  test('should set up event listeners on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderWithContext();

    expect(addEventListenerSpy).toHaveBeenCalledWith(AUTH_EXPIRY_WARNING, expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith(SESSION_TIMEOUT, expect.any(Function));
  });

  test('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderWithContext();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(AUTH_EXPIRY_WARNING, expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith(SESSION_TIMEOUT, expect.any(Function));
  });

  test('should show modal when AUTH_EXPIRY_WARNING event is dispatched', async () => {
    renderWithContext();

    const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
    expect(modalWrapper).toHaveClass('is-hidden');

    // Dispatch the AUTH_EXPIRY_WARNING event
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      expect(modalWrapper).toHaveClass('is-visible');
    });
  });

  test('should call logout when SESSION_TIMEOUT event is dispatched', async () => {
    renderWithContext();

    // Dispatch the SESSION_TIMEOUT event
    window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  test('should call resetLastInteraction and renewOktaToken when Stay Logged In is clicked', async () => {
    const user = userEvent.setup();
    const renewOktaTokenSpy = vi.spyOn(oktaLibrary, 'renewOktaToken').mockResolvedValue();

    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
      expect(modalWrapper).toHaveClass('is-visible');
    });

    // Click the "Stay Logged In" button
    const stayLoggedInButton = screen.getByText('Stay Logged In');
    await user.click(stayLoggedInButton);

    expect(resetLastInteractionSpy).toHaveBeenCalled();
    expect(renewOktaTokenSpy).toHaveBeenCalledWith(mockOktaAuth);
  });

  test('should show success alert when Stay Logged In is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(oktaLibrary, 'renewOktaToken').mockResolvedValue();

    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
      expect(modalWrapper).toHaveClass('is-visible');
    });

    // Click the "Stay Logged In" button
    const stayLoggedInButton = screen.getByText('Stay Logged In');
    await user.click(stayLoggedInButton);

    expect(mockGlobalAlertRef.current.success).toHaveBeenCalledWith(
      'Your session has been extended',
    );
  });

  test('should handle oktaAuth being null', async () => {
    const user = userEvent.setup();
    const renewOktaTokenSpy = vi.spyOn(oktaLibrary, 'renewOktaToken').mockResolvedValue();

    const authContextWithoutOkta = {
      oktaAuth: undefined,
      login: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <AuthContext.Provider value={authContextWithoutOkta}>
        <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
          <SessionTimeoutManager />
        </GlobalAlertContext.Provider>
      </AuthContext.Provider>,
    );

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
      expect(modalWrapper).toHaveClass('is-visible');
    });

    // Click the "Stay Logged In" button
    const stayLoggedInButton = screen.getByText('Stay Logged In');
    await user.click(stayLoggedInButton);

    expect(resetLastInteractionSpy).toHaveBeenCalled();
    // renewOktaToken should NOT be called when oktaAuth is null
    expect(renewOktaTokenSpy).not.toHaveBeenCalled();
  });

  test('should call logout when Log Out Now is clicked', async () => {
    const user = userEvent.setup();

    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
      expect(modalWrapper).toHaveClass('is-visible');
    });

    // Click the "Log Out Now" button
    const logoutButton = screen.getByText('Log Out Now');
    await user.click(logoutButton);

    expect(logoutSpy).toHaveBeenCalled();
  });

  test('should pass correct warningSeconds prop to modal', async () => {
    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      const modalWrapper = screen.getByTestId('modal-session-timeout-warning');
      expect(modalWrapper).toHaveClass('is-visible');
    });

    // Check that the modal content includes the timing information
    expect(screen.getByText(/Your session will expire in/i)).toBeInTheDocument();
  });
});
