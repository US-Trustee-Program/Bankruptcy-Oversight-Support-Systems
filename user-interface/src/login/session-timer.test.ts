import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import * as UseCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { mockConfiguration } from '@/lib/testing/mock-configuration';
import {
  SESSION_TIMEOUT,
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  LOGOUT_TIMER,
  ACTIVITY_THROTTLE_MS,
  createTimer,
  isUserActive,
  resetLastInteraction,
  getLastInteraction,
  checkForInactivity,
  logout,
  initializeInteractionListeners,
  throttledResetLastInteraction,
  resetActivityThrottle,
  registerLogoutCleanupHandler,
  unregisterLogoutCleanupHandler,
  cancelPendingLogout,
} from './session-timer';

function stubWindowLocation() {
  Object.defineProperty(window, 'location', {
    value: {
      host: 'example.com',
      protocol: 'https:',
    },
    writable: true,
  });
}

describe('Timer Factory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
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
  beforeEach(() => {
    vi.restoreAllMocks();
    stubWindowLocation();
  });

  test('should construct logout URI and call redirectTo', () => {
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    logout();

    expect(redirectToSpy).toHaveBeenCalledWith('https://example.com/logout');
  });
});

describe('checkForInactivity function', () => {
  const NOW = 100000;
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    stubWindowLocation();
    mockConfiguration({ featureFlagsMode: undefined });
  });

  test.each([
    ['lastInteraction is null', null],
    ['timeout has passed', NOW - (TIMEOUT + 1000)],
  ])('should call logout when %s', (_description, lastInteraction) => {
    vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(lastInteraction);
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    checkForInactivity();

    expect(redirectToSpy).toHaveBeenCalledWith('https://example.com/logout');
  });

  test('should not call logout when user is active', () => {
    const lastInteraction = NOW - 5 * 60 * 1000; // 5 minutes ago (well before timeout)
    vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(lastInteraction);
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    checkForInactivity();

    expect(redirectToSpy).not.toHaveBeenCalled();
  });

  test('should not call logout when running in test feature flag mode, even if idle', () => {
    mockConfiguration({ featureFlagsMode: 'test' });
    vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(null);
    const redirectToSpy = vi.spyOn(UseCamsNavigator, 'redirectTo').mockImplementation(() => {});

    checkForInactivity();

    expect(redirectToSpy).not.toHaveBeenCalled();
  });
});

describe('initializeInteractionListeners function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    document.removeEventListener('click', resetLastInteraction, true);
    document.removeEventListener('keydown', resetLastInteraction, true);
    document.removeEventListener('mousemove', throttledResetLastInteraction, { capture: true });
    document.removeEventListener('scroll', throttledResetLastInteraction, { capture: true });
  });

  test('should register click and keydown listeners in the capture phase', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    initializeInteractionListeners();

    expect(addEventListenerSpy).toHaveBeenCalledWith('click', resetLastInteraction, true);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', resetLastInteraction, true);
  });

  test('should not register a keypress listener, since it misses non-printable keys like Tab/Arrow/Escape', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    initializeInteractionListeners();

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('keypress', expect.anything());
  });

  test('should register a throttled, passive, capture-phase mousemove listener', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    initializeInteractionListeners();

    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', throttledResetLastInteraction, {
      capture: true,
      passive: true,
    });
  });

  test('should register a throttled, passive, capture-phase scroll listener, since scroll does not bubble', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    initializeInteractionListeners();

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', throttledResetLastInteraction, {
      capture: true,
      passive: true,
    });
  });

  test('should record activity from a click that a descendant stops from bubbling', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    initializeInteractionListeners();

    const descendant = document.createElement('button');
    descendant.addEventListener('click', (event) => event.stopPropagation());
    document.body.appendChild(descendant);

    descendant.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.body.removeChild(descendant);

    expect(setLastInteractionSpy).toHaveBeenCalled();
  });

  test('should record activity from a keydown that a descendant stops from bubbling', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    initializeInteractionListeners();

    const descendant = document.createElement('input');
    descendant.addEventListener('keydown', (event) => event.stopPropagation());
    document.body.appendChild(descendant);

    descendant.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    document.body.removeChild(descendant);

    expect(setLastInteractionSpy).toHaveBeenCalled();
  });
});

describe('throttledResetLastInteraction function', () => {
  const NOW = 500000;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetActivityThrottle();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  test('should reset last interaction on the first call', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    throttledResetLastInteraction();

    expect(setLastInteractionSpy).toHaveBeenCalledWith(NOW);
  });

  test('should not reset last interaction again within the throttle window', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    throttledResetLastInteraction();
    setLastInteractionSpy.mockClear();

    vi.spyOn(Date, 'now').mockReturnValue(NOW + ACTIVITY_THROTTLE_MS - 1);
    throttledResetLastInteraction();

    expect(setLastInteractionSpy).not.toHaveBeenCalled();
  });

  test('should reset last interaction again once the throttle window has elapsed', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    throttledResetLastInteraction();
    setLastInteractionSpy.mockClear();

    const later = NOW + ACTIVITY_THROTTLE_MS;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    throttledResetLastInteraction();

    expect(setLastInteractionSpy).toHaveBeenCalledWith(later);
  });
});

describe('Logout cleanup handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Reset module-level state to prevent test interdependence
    unregisterLogoutCleanupHandler();
  });

  test('cancelPendingLogout should reset last interaction', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    cancelPendingLogout();

    expect(setLastInteractionSpy).toHaveBeenCalledWith(now);
  });

  test('cancelPendingLogout should call registered cleanup handler', () => {
    const cleanupHandler = vi.fn();
    registerLogoutCleanupHandler(cleanupHandler);

    cancelPendingLogout();

    expect(cleanupHandler).toHaveBeenCalledTimes(1);
  });

  test('cancelPendingLogout should not crash when no handler is registered', () => {
    const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');

    // Explicitly unregister to simulate no provider
    unregisterLogoutCleanupHandler();

    expect(() => cancelPendingLogout()).not.toThrow();
    expect(setLastInteractionSpy).toHaveBeenCalled();
  });

  test('unregisterLogoutCleanupHandler should clear the handler', () => {
    const cleanupHandler = vi.fn();
    registerLogoutCleanupHandler(cleanupHandler);

    unregisterLogoutCleanupHandler();

    cancelPendingLogout();

    // Handler should not be called after unregistering
    expect(cleanupHandler).not.toHaveBeenCalled();
  });

  test('registerLogoutCleanupHandler should accept null to clear handler', () => {
    const cleanupHandler = vi.fn();
    registerLogoutCleanupHandler(cleanupHandler);

    // Register null to clear
    registerLogoutCleanupHandler(null);

    cancelPendingLogout();

    // Handler should not be called after registering null
    expect(cleanupHandler).not.toHaveBeenCalled();
  });
});

describe('Constants', () => {
  test.each([
    ['SESSION_TIMEOUT', SESSION_TIMEOUT, 'session-timeout'],
    ['AUTH_EXPIRY_WARNING', AUTH_EXPIRY_WARNING, 'auth-expiry-warning'],
    ['HEARTBEAT', HEARTBEAT, 60000],
    ['LOGOUT_TIMER', LOGOUT_TIMER, 60000],
  ])('%s should be %s', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});
