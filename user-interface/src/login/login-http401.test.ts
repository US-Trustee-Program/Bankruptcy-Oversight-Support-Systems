import { describe, expect } from 'vitest';
import { http401Hook } from './login-http401';
import { LOGOUT_PATH } from './login-library';
import * as configModule from '@/configuration/apiConfiguration';

describe('Login HTTP 401 handler', () => {
  describe('http401Hook', () => {
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

    beforeEach(() => {
      vi.clearAllMocks();
      window.location = { ...mockLocation };
    });

    afterAll(() => {
      window.location = originalLocation;
    });

    test('should redirect if the http response code from the cams API is 401.', () => {
      const isCamsApi = vi.spyOn(configModule, 'isCamsApi').mockReturnValue(true);
      const response = {
        status: 401,
        url: 'a-cams-url',
      } as Response;

      http401Hook(response);

      const logoutUri = protocol + '//' + host + LOGOUT_PATH;
      expect(assign).toHaveBeenCalledWith(logoutUri);
      expect(isCamsApi).toHaveBeenCalled();
    });

    test('should do nothing if the http response code from the cams API is not 401.', () => {
      const isCamsApi = vi.spyOn(configModule, 'isCamsApi').mockReturnValue(true);
      const response = {
        status: 200,
        url: 'a-cams-url',
      } as Response;

      http401Hook(response);

      expect(isCamsApi).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });

    test('should do nothing if the http response code is 401 from a third party API.', () => {
      const isCamsApi = vi.spyOn(configModule, 'isCamsApi').mockReturnValue(false);
      const response = {
        status: 401,
        url: 'a-thrirdParty-url',
      } as Response;

      http401Hook(response);
      expect(isCamsApi).toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });
  });
});
