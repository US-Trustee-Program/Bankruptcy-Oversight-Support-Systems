import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import * as UseCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import {
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  WARNING_THRESHOLD,
  SAFE_LIMIT,
  LOGOUT_TIMER,
  createTimer,
  isUserActive,
  getTimeUntilTimeout,
  shouldShowWarning,
  shouldLogout,
  resetLastInteraction,
  getLastInteraction,
  checkForInactivity,
  logout,
  initializeInactiveLogout,
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
    test('should return false if lastInteraction is null', () => {
      expect(isUserActive(null)).toBe(false);
    });

    test('should return true if last interaction is within heartbeat window', () => {
      const recentInteraction = NOW - HEARTBEAT / 2;
      expect(isUserActive(recentInteraction, HEARTBEAT)).toBe(true);
    });

    test('should return false if last interaction is beyond heartbeat window', () => {
      const oldInteraction = NOW - (HEARTBEAT + 1000);
      expect(isUserActive(oldInteraction, HEARTBEAT)).toBe(false);
    });
  });

  describe('getTimeUntilTimeout', () => {
    const TIMEOUT = 30 * 60 * 1000; // 30 minutes

    test('should return 0 if lastInteraction is null', () => {
      expect(getTimeUntilTimeout(null, TIMEOUT)).toBe(0);
    });

    test('should return correct time until timeout', () => {
      const lastInteraction = NOW - 10 * 60 * 1000; // 10 minutes ago
      const expected = TIMEOUT - 10 * 60 * 1000; // 20 minutes remaining
      expect(getTimeUntilTimeout(lastInteraction, TIMEOUT)).toBe(expected);
    });

    test('should return negative value if timeout has passed', () => {
      const lastInteraction = NOW - 31 * 60 * 1000; // 31 minutes ago
      const result = getTimeUntilTimeout(lastInteraction, TIMEOUT);
      expect(result).toBeLessThan(0);
    });
  });

  describe('shouldShowWarning', () => {
    const WARNING_THRESHOLD = 60 * 1000; // 60 seconds

    test('should return true if within warning threshold', () => {
      const timeUntilTimeout = 30 * 1000; // 30 seconds
      expect(shouldShowWarning(timeUntilTimeout, WARNING_THRESHOLD)).toBe(true);
    });

    test('should return false if outside warning threshold', () => {
      const timeUntilTimeout = 2 * 60 * 1000; // 2 minutes
      expect(shouldShowWarning(timeUntilTimeout, WARNING_THRESHOLD)).toBe(false);
    });

    test('should return false if timeout has passed', () => {
      const timeUntilTimeout = -1000;
      expect(shouldShowWarning(timeUntilTimeout, WARNING_THRESHOLD)).toBe(false);
    });
  });

  describe('shouldLogout', () => {
    test('should return true if timeUntilTimeout is 0', () => {
      expect(shouldLogout(0)).toBe(true);
    });

    test('should return true if timeUntilTimeout is negative', () => {
      expect(shouldLogout(-1000)).toBe(true);
    });

    test('should return false if timeUntilTimeout is positive', () => {
      expect(shouldLogout(1000)).toBe(false);
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

  test('should dispatch SESSION_TIMEOUT event when within warning threshold', () => {
    const TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const lastInteraction = NOW - (TIMEOUT - 30 * 1000); // 30 seconds until timeout

    const getLastInteractionSpy = vi
      .spyOn(LocalStorage, 'getLastInteraction')
      .mockReturnValue(lastInteraction);
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    checkForInactivity();

    expect(getLastInteractionSpy).toHaveBeenCalled();
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SESSION_TIMEOUT,
      }),
    );

    getLastInteractionSpy.mockRestore();
    dispatchEventSpy.mockRestore();
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

describe('initializeInactiveLogout function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    document.body.removeEventListener('click', resetLastInteraction);
    document.body.removeEventListener('keypress', resetLastInteraction);
  });

  test('should set up interval and event listeners', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const addEventListenerSpy = vi.spyOn(document.body, 'addEventListener');

    initializeInactiveLogout();

    expect(setIntervalSpy).toHaveBeenCalledWith(checkForInactivity, 60000);
    expect(addEventListenerSpy).toHaveBeenCalledWith('click', resetLastInteraction);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keypress', resetLastInteraction);

    setIntervalSpy.mockRestore();
    addEventListenerSpy.mockRestore();
    vi.useRealTimers();
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

  test('WARNING_THRESHOLD should be 1 minute', () => {
    expect(WARNING_THRESHOLD).toBe(60000); // 60 * 1000
  });

  test('SAFE_LIMIT should be 300 seconds', () => {
    expect(SAFE_LIMIT).toBe(300);
  });

  test('LOGOUT_TIMER should be 1 minute', () => {
    expect(LOGOUT_TIMER).toBe(60000); // 60 * 1000
  });
});
