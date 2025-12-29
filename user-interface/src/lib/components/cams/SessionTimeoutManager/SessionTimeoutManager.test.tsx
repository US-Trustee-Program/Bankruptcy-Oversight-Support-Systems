import { render, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import SessionTimeoutManager from './SessionTimeoutManager';
import { AUTH_EXPIRY_WARNING, SESSION_TIMEOUT_WARNING } from '@/login/providers/okta/okta-library';
import * as inactiveLogout from '@/login/inactive-logout';
import * as oktaLibrary from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';
import { GlobalAlertContext } from '@/App';
import OktaAuth from '@okta/okta-auth-js';

// Mock the SessionTimeoutWarningModal component
const mockShow = vi.fn();
const mockHide = vi.fn();

vi.mock('../SessionTimeoutWarningModal/SessionTimeoutWarningModal', () => ({
  default: vi.fn().mockImplementation((_props, ref) => {
    // Expose the ref methods for testing
    if (ref && typeof ref === 'function') {
      ref({ show: mockShow, hide: mockHide });
    } else if (ref && typeof ref === 'object' && ref.current !== undefined) {
      ref.current = { show: mockShow, hide: mockHide };
    }
    return <div data-testid="session-timeout-modal">Mock Modal</div>;
  }),
}));

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

  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(getByTestId('session-timeout-modal')).toBeInTheDocument();
  });

  test('should set up event listeners on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderWithContext();

    expect(addEventListenerSpy).toHaveBeenCalledWith(AUTH_EXPIRY_WARNING, expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith(SESSION_TIMEOUT_WARNING, expect.any(Function));
  });

  test('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderWithContext();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(AUTH_EXPIRY_WARNING, expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      SESSION_TIMEOUT_WARNING,
      expect.any(Function),
    );
  });

  test('should show modal when AUTH_EXPIRY_WARNING event is dispatched', async () => {
    renderWithContext();

    // Dispatch the AUTH_EXPIRY_WARNING event
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalled();
    });
  });

  test('should call logout when SESSION_TIMEOUT_WARNING event is dispatched', async () => {
    const logoutSpy = vi.spyOn(inactiveLogout, 'logout');

    renderWithContext();

    // Dispatch the SESSION_TIMEOUT_WARNING event
    window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT_WARNING));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  test('should call resetLastInteraction and renewOktaToken when Stay Logged In is clicked', async () => {
    const resetLastInteractionSpy = vi.spyOn(inactiveLogout, 'resetLastInteraction');
    const renewOktaTokenSpy = vi.spyOn(oktaLibrary, 'renewOktaToken').mockResolvedValue();

    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalled();
    });

    // Get the modal props (onStayLoggedIn callback)
    const SessionTimeoutWarningModal = vi.mocked(
      await import('../SessionTimeoutWarningModal/SessionTimeoutWarningModal'),
    ).default;
    const modalProps = (SessionTimeoutWarningModal as Mock).mock.calls[0][0];

    // Call the onStayLoggedIn handler
    await modalProps.onStayLoggedIn();

    expect(resetLastInteractionSpy).toHaveBeenCalled();
    expect(renewOktaTokenSpy).toHaveBeenCalledWith(mockOktaAuth);
  });

  test('should show success alert when Stay Logged In is clicked', async () => {
    vi.spyOn(inactiveLogout, 'resetLastInteraction');
    vi.spyOn(oktaLibrary, 'renewOktaToken').mockResolvedValue();

    renderWithContext();

    // Dispatch AUTH_EXPIRY_WARNING to open the modal
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalled();
    });

    // Get the modal props (onStayLoggedIn callback)
    const SessionTimeoutWarningModal = vi.mocked(
      await import('../SessionTimeoutWarningModal/SessionTimeoutWarningModal'),
    ).default;
    const modalProps = (SessionTimeoutWarningModal as Mock).mock.calls[0][0];

    // Call the onStayLoggedIn handler
    await modalProps.onStayLoggedIn();

    expect(mockGlobalAlertRef.current.success).toHaveBeenCalledWith(
      'Your session has been extended',
    );
  });

  test('should handle oktaAuth being null', async () => {
    const resetLastInteractionSpy = vi.spyOn(inactiveLogout, 'resetLastInteraction');
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
      expect(mockShow).toHaveBeenCalled();
    });

    // Get the modal props (onStayLoggedIn callback)
    const SessionTimeoutWarningModal = vi.mocked(
      await import('../SessionTimeoutWarningModal/SessionTimeoutWarningModal'),
    ).default;
    const modalProps = (SessionTimeoutWarningModal as Mock).mock.calls[0][0];

    // Call the onStayLoggedIn handler
    await modalProps.onStayLoggedIn();

    expect(resetLastInteractionSpy).toHaveBeenCalled();
    // renewOktaToken should NOT be called when oktaAuth is null
    expect(renewOktaTokenSpy).not.toHaveBeenCalled();
  });

  test('should call logout when Log Out Now is clicked', async () => {
    const logoutSpy = vi.spyOn(inactiveLogout, 'logout');

    renderWithContext();

    // Get the modal props (onLogoutNow callback)
    const SessionTimeoutWarningModal = vi.mocked(
      await import('../SessionTimeoutWarningModal/SessionTimeoutWarningModal'),
    ).default;
    const modalProps = (SessionTimeoutWarningModal as Mock).mock.calls[0][0];

    // Call the onLogoutNow handler
    modalProps.onLogoutNow();

    expect(logoutSpy).toHaveBeenCalled();
  });

  test('should pass correct warningSeconds prop to modal', async () => {
    renderWithContext();

    // Get the modal props
    const SessionTimeoutWarningModal = vi.mocked(
      await import('../SessionTimeoutWarningModal/SessionTimeoutWarningModal'),
    ).default;
    const modalProps = (SessionTimeoutWarningModal as Mock).mock.calls[0][0];

    expect(modalProps.warningSeconds).toBe(60);
  });
});
