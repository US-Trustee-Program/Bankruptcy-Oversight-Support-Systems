import { describe } from 'vitest';
import LocalStorage from '../lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import {
  checkForInactivity,
  initializeInactiveLogout,
  resetLastInteraction,
} from './login-inactive-logout';

describe('Login Inactive Logout', () => {
  describe('inactiveLogoutHook', () => {
    const NOW = 100000;
    const ONE_HOUR = 60 * 60 * 1000;
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
      window.location = { ...mockLocation };
    });

    afterAll(() => {
      window.location = originalLocation;
    });

    test('should logout and redirect if inactivity exceeds timeout', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW - ONE_HOUR);
      vi.spyOn(Date, 'now').mockReturnValue(NOW);

      checkForInactivity();

      expect(assign).toHaveBeenCalledWith(logoutUri);
    });

    test('should do nothing if timeout value has not been exceeded', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(NOW);
      vi.spyOn(Date, 'now').mockReturnValue(NOW);

      checkForInactivity();

      expect(assign).not.toHaveBeenCalled();
    });

    test('should logout if the last interaction was not recorded in localStorage', () => {
      vi.spyOn(LocalStorage, 'getLastInteraction').mockReturnValue(null);
      vi.spyOn(Date, 'now').mockReturnValue(NOW);

      checkForInactivity();

      expect(assign).toHaveBeenCalledWith(logoutUri);
    });
  });

  describe('initializeInactiveLogout', () => {
    test('should set an interval timer and event listeners', () => {
      const setInterval = vi.spyOn(window, 'setInterval');
      const addEventListener = vi.spyOn(document.body, 'addEventListener');

      initializeInactiveLogout();

      expect(setInterval).toHaveBeenCalledWith(checkForInactivity, expect.any(Number));
      expect(addEventListener).toHaveBeenCalledWith('click', resetLastInteraction);
      expect(addEventListener).toHaveBeenCalledWith('keypress', resetLastInteraction);
    });
  });
});
