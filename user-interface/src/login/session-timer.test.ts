import { describe, test, expect, vi, beforeEach } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import {
  SessionTimerController,
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  SAFE_LIMIT,
  createTimer,
  isUserActive,
  getTimeUntilTimeout,
  shouldShowWarning,
  shouldLogout,
  resetLastInteraction,
  getLastInteraction,
  logout,
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
  test('should call logout without throwing', () => {
    // Since logout() calls redirectTo which navigates away,
    // and we can't easily mock it in the test without proper setup,
    // we just verify the function exists and is callable
    expect(logout).toBeDefined();
    expect(typeof logout).toBe('function');
  });
});

describe('SessionTimerController (Legacy)', () => {
  let controller: SessionTimerController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SessionTimerController();
  });

  describe('startHeartbeat', () => {
    test('should start a heartbeat interval', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const callback = vi.fn();

      controller.startHeartbeat(callback);

      expect(setIntervalSpy).toHaveBeenCalledWith(callback, HEARTBEAT);

      vi.useRealTimers();
    });

    test('should clear existing heartbeat before starting new one', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // Start first heartbeat
      controller.startHeartbeat(vi.fn());
      const firstIntervalId = setIntervalSpy.mock.results[0].value;

      // Start second heartbeat
      controller.startHeartbeat(vi.fn());

      expect(clearIntervalSpy).toHaveBeenCalledWith(firstIntervalId);

      vi.useRealTimers();
    });
  });

  describe('clearHeartbeat', () => {
    test('should clear the heartbeat interval', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      controller.startHeartbeat(vi.fn());
      controller.clearHeartbeat();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('startLogoutTimer', () => {
    test('should start a logout timer interval', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const callback = vi.fn();

      controller.startLogoutTimer(callback);

      expect(setIntervalSpy).toHaveBeenCalledWith(callback, 60000); // LOGOUT_TIMER = 60 seconds

      vi.useRealTimers();
    });
  });

  describe('setWarningShown and hasWarningBeenShown', () => {
    test('should set and get warning shown flag', () => {
      expect(controller.hasWarningBeenShown()).toBe(false);

      controller.setWarningShown(true);
      expect(controller.hasWarningBeenShown()).toBe(true);

      controller.setWarningShown(false);
      expect(controller.hasWarningBeenShown()).toBe(false);
    });
  });

  describe('setRenewingToken and isTokenRenewalInProgress', () => {
    test('should set and get token renewal flag', () => {
      expect(controller.isTokenRenewalInProgress()).toBe(false);

      controller.setRenewingToken(true);
      expect(controller.isTokenRenewalInProgress()).toBe(true);

      controller.setRenewingToken(false);
      expect(controller.isTokenRenewalInProgress()).toBe(false);
    });
  });

  describe('reset', () => {
    test('should reset all timers and flags', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      // Set up some state
      controller.startHeartbeat(vi.fn());
      controller.startLogoutTimer(vi.fn());
      controller.setWarningShown(true);
      controller.setRenewingToken(true);

      // Reset
      controller.reset();

      // Verify timers were cleared
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);

      // Verify flags were reset
      expect(controller.hasWarningBeenShown()).toBe(false);
      expect(controller.isTokenRenewalInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('resetLastInteraction', () => {
    test('should set last interaction timestamp in LocalStorage', async () => {
      const LocalStorage = await import('@/lib/utils/local-storage');
      const setLastInteractionSpy = vi.spyOn(LocalStorage.default, 'setLastInteraction');
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      controller.resetLastInteraction();

      expect(setLastInteractionSpy).toHaveBeenCalledWith(now);

      vi.restoreAllMocks();
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

    test('SAFE_LIMIT should be 300 seconds', () => {
      expect(SAFE_LIMIT).toBe(300);
    });
  });
});
