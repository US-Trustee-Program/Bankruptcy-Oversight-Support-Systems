import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  SessionTimerController,
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  SAFE_LIMIT,
} from './session-timer-controller';

describe('SessionTimerController', () => {
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

    test('should clear existing logout timer before starting new one', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // Start first timer
      controller.startLogoutTimer(vi.fn());
      const firstIntervalId = setIntervalSpy.mock.results[0].value;

      // Start second timer
      controller.startLogoutTimer(vi.fn());

      expect(clearIntervalSpy).toHaveBeenCalledWith(firstIntervalId);

      vi.useRealTimers();
    });
  });

  describe('clearLogoutTimer', () => {
    test('should clear the logout timer interval', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      controller.startLogoutTimer(vi.fn());
      controller.clearLogoutTimer();

      expect(clearIntervalSpy).toHaveBeenCalled();

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
