import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import {
  checkForInactivity,
  initializeInactiveLogout,
  resetLastInteraction,
  SESSION_TIMEOUT,
} from './inactive-logout';

describe('Login Inactive Logout', () => {
  describe('inactiveLogoutHook', () => {
    const NOW = 100000;
    const ONE_HOUR = 60 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const originalLocation = window.location;

    const host = 'camshost';
    const protocol = 'http:';

    const assign = vi.fn();

    const mockLocation: Location = {
      assign,
      host,
      protocol,
      hash: '',
      hostname: '',
      href: '',
      origin: '',
      pathname: '',
      port: '',
      search: '',
      reload: vi.fn(),
      replace: vi.fn(),
      ancestorOrigins: {
        length: 0,
        item: vi.fn(),
        contains: vi.fn(),
        [Symbol.iterator]: vi.fn(),
      },
    } as const;

    const logoutUri = protocol + '//' + host + LOGOUT_PATH;

    beforeEach(() => {
      vi.clearAllMocks();
      // @ts-expect-error `location` is a readonly property. As this is just a test, we do not care.
      window.location = { ...mockLocation };
      // Mock Date.now and setLastInteraction before calling resetLastInteraction
      vi.spyOn(Date, 'now').mockReturnValue(NOW);
      vi.spyOn(LocalStorage, 'setLastInteraction').mockImplementation(() => {});
      // Reset the module-level warningEmitted flag by calling resetLastInteraction
      resetLastInteraction();
    });

    afterAll(() => {
      // @ts-expect-error `location` is a readonly property. As this is just a test, we do not care.
      window.location = originalLocation;
    });

    test('should logout and redirect if inactivity exceeds timeout', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW - ONE_HOUR);

      checkForInactivity();

      expect(assign).toHaveBeenCalledWith(logoutUri);
    });

    test('should do nothing if timeout value has not been exceeded', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW);

      checkForInactivity();

      expect(assign).not.toHaveBeenCalled();
    });

    test('should logout if the last interaction was not recorded in localStorage', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(null);

      checkForInactivity();

      expect(assign).toHaveBeenCalledWith(logoutUri);
    });

    test('should emit SESSION_TIMEOUT event when within warning threshold', () => {
      // Set last interaction to be 30 minutes minus 30 seconds ago (within warning threshold)
      const lastInteraction = NOW - THIRTY_MINUTES + 30000;
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(lastInteraction);

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      checkForInactivity();

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SESSION_TIMEOUT,
        }),
      );
      expect(assign).not.toHaveBeenCalled();
    });

    test('should emit SESSION_TIMEOUT event only once', () => {
      // Set last interaction to be within warning threshold
      const lastInteraction = NOW - THIRTY_MINUTES + 30000;
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(lastInteraction);

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      // First check should emit the event
      checkForInactivity();
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

      dispatchEventSpy.mockClear();

      // Second check should NOT emit the event again
      checkForInactivity();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should not emit warning if outside warning threshold', () => {
      // Set last interaction to be 28 minutes ago (outside warning threshold)
      // timeUntilTimeout = 30min - 28min = 2min = 120 seconds, which is > 60 seconds threshold
      const lastInteraction = NOW - 28 * 60 * 1000;
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(lastInteraction);

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      checkForInactivity();

      expect(dispatchEventSpy).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });
  });

  describe('resetLastInteraction', () => {
    const NOW = 100000;
    const THIRTY_MINUTES = 30 * 60 * 1000;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.spyOn(Date, 'now').mockReturnValue(NOW);
      vi.spyOn(LocalStorage, 'setLastInteraction').mockImplementation(() => {});
      // Reset the module-level warningEmitted flag
      resetLastInteraction();
    });

    test('should set last interaction timestamp and reset warning flag', () => {
      const setLastInteractionSpy = vi.spyOn(LocalStorage, 'setLastInteraction');
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW - THIRTY_MINUTES + 30000);

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      // First, emit the warning
      checkForInactivity();
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

      dispatchEventSpy.mockClear();

      // Reset the interaction
      resetLastInteraction();
      expect(setLastInteractionSpy).toHaveBeenCalledWith(NOW);

      // After reset, the warning should be able to be emitted again
      checkForInactivity();
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeInactiveLogout', () => {
    test('should set an interval timer and event listeners', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const addEventListener = vi.spyOn(document.body, 'addEventListener');

      initializeInactiveLogout();

      expect(setIntervalSpy).toHaveBeenCalledWith(checkForInactivity, expect.any(Number));
      expect(addEventListener).toHaveBeenCalledWith('click', resetLastInteraction);
      expect(addEventListener).toHaveBeenCalledWith('keypress', resetLastInteraction);
    });
  });
});
