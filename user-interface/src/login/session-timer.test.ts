import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import * as UseCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import {
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  LOGOUT_TIMER,
  createTimer,
  isUserActive,
  resetLastInteraction,
  getLastInteraction,
  checkForInactivity,
  logout,
  initializeInteractionListeners,
  registerLogoutCleanupHandler,
  cancelPendingLogout,
} from './session-timer';

describe('Timer Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('createTimer should create a timer and return id and clear function', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const timer = createTimer(callback, 1000);

    expect(timer.id).toBeDefined();
    expect(timer.clear).toBeTypeOf('function');

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    timer.clear();
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1); // Should not be called again

    vi.useRealTimers();
  });
});

describe('Stateless Helper Functions', () => {
  const NOW = 100000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  describe('isUserActive', () => {
    const TIMEOUT = 30 * 60 * 1000; // 30 minutes (default timeout)

    test('should return false if lastInteraction is null', () => {
      expect(isUserActive(null)).toBe(false);
    });

    test('should return true if last interaction is within timeout window', () => {
      const recentInteraction = NOW - TIMEOUT / 2;
      expect(isUserActive(recentInteraction)).toBe(true);
    });

    test('should return false if last interaction is beyond timeout window', () => {
      const oldInteraction = NOW - (TIMEOUT + 1000);
      expect(isUserActive(oldInteraction)).toBe(false);
    });
  });
});

describe('Session Interaction Functions', () => {
  const NOW = 100000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  test('resetLastInteraction should set last interaction timestamp', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    resetLastInteraction();

    expect(setLastInteractionSpy).toHaveBeenCalledWith(NOW);
  });

  test('getLastInteraction should return last interaction from LocalStorage', () => {
    const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW);

    const result = getLastInteraction();

    expect(result).toBe(NOW);
    expect(getLastInteractionSpy).toHaveBeenCalled();
  });
});

describe('logout function', () => {
  test('should construct logout URI and call redirectTo', () => {
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        host: 'example.com',
        protocol: 'https:',
      },
      writable: true,
    });

    logout();

    expect(redirectToSpy).toHaveBeenCalledWith('https://example.com/logout');
    redirectToSpy.mockRestore();
  });
});

describe('checkForInactivity function', () => {
  const NOW = 100000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  test('should call logout if lastInteraction is null', () => {
    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(null);
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    Object.defineProperty(window, 'location', {
      value: {
        host: 'example.com',
        protocol: 'https:',
      },
      writable: true,
    });

    checkForInactivity();

    expect(getLastInteractionSpy).toHaveBeenCalled();
    expect(redirectToSpy).toHaveBeenCalledWith('https://example.com/logout');

    getLastInteractionSpy.mockRestore();
    redirectToSpy.mockRestore();
  });

  test('should call logout when timeout has passed', () => {
    const TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const lastInteraction = NOW - (TIMEOUT + 1000); // 1 second past timeout

    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(lastInteraction);
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    Object.defineProperty(window, 'location', {
      value: {
        host: 'example.com',
        protocol: 'https:',
      },
      writable: true,
    });

    checkForInactivity();

    expect(getLastInteractionSpy).toHaveBeenCalled();
    expect(redirectToSpy).toHaveBeenCalledWith('https://example.com/logout');

    getLastInteractionSpy.mockRestore();
    redirectToSpy.mockRestore();
  });

  test('should do nothing when user is active and not within warning threshold', () => {
    const lastInteraction = NOW - 5 * 60 * 1000; // 5 minutes ago (well before timeout)

    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(lastInteraction);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    checkForInactivity();

    expect(getLastInteractionSpy).toHaveBeenCalled();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
    expect(redirectToSpy).not.toHaveBeenCalled();

    getLastInteractionSpy.mockRestore();
    dispatchEventSpy.mockRestore();
    redirectToSpy.mockRestore();
  });
});

describe('initializeInteractionListeners function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    document.body.removeEventListener('click', resetLastInteraction);
    document.body.removeEventListener('keypress', resetLastInteraction);
  });

  test('should set up event listeners for user activity tracking', () => {
    const addEventListenerSpy = vi.spyOn(document.body, 'addEventListener');

    initializeInteractionListeners();

    expect(addEventListenerSpy).toHaveBeenCalledWith('click', resetLastInteraction);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keypress', resetLastInteraction);
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

    addEventListenerSpy.mockRestore();
  });
});

describe('Logout cleanup handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('registerLogoutCleanupHandler should register a cleanup handler', () => {
    const cleanupHandler = vi.fn();

    registerLogoutCleanupHandler(cleanupHandler);

    // Verify handler is registered by calling cancelPendingLogout
    cancelPendingLogout();

    expect(cleanupHandler).toHaveBeenCalledTimes(1);
  });

  test('cancelPendingLogout should reset last interaction', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    cancelPendingLogout();

    expect(setLastInteractionSpy).toHaveBeenCalledWith(now);

    setLastInteractionSpy.mockRestore();
  });

  test('cancelPendingLogout should call registered cleanup handler', () => {
    const cleanupHandler = vi.fn();
    registerLogoutCleanupHandler(cleanupHandler);

    cancelPendingLogout();

    expect(cleanupHandler).toHaveBeenCalledTimes(1);
  });

  test('cancelPendingLogout should not crash when no handler is registered', () => {
    // Reset handler by registering null (simulating no provider)
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    expect(() => cancelPendingLogout()).not.toThrow();
    expect(setLastInteractionSpy).toHaveBeenCalled();

    setLastInteractionSpy.mockRestore();
  });
});

describe('Constants', () => {
  test('SESSION_TIMEOUT should be exported', () => {
    expect(SESSION_TIMEOUT).toBe('session-timeout');
  });

  test('AUTH_EXPIRY_WARNING should be exported', () => {
    expect(AUTH_EXPIRY_WARNING).toBe('auth-expiry-warning');
  });

  test('HEARTBEAT should be 1 minute', () => {
    expect(HEARTBEAT).toBe(60000); // 60 * 1000
  });

  test('LOGOUT_TIMER should be 1 minute', () => {
    expect(LOGOUT_TIMER).toBe(60000); // 60 * 1000
  });
});
