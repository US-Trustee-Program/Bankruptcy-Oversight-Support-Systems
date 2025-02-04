import { HttpRequest } from '@azure/functions';
import { isAuthorized } from './dataflows-common';

describe('Dataflows Common', () => {
  describe('isAuthorized', () => {
    const RIGHT = 'this-is-a-key';
    const WRONG = 'this-is-a-bad-key';

    const env = process.env;
    beforeAll(() => {
      process.env = {
        ADMIN_KEY: RIGHT,
      };
    });

    afterAll(() => {
      process.env = env;
    });

    test('should return true', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${RIGHT}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeTruthy();
    });

    test('should return false when authorization header is missing', async () => {
      const request = {
        headers: new Map<string, string>(),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when authorization header scheme is missing', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', RIGHT]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when authorization header scheme is incorrect', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `Bearer ${RIGHT}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when api key does not match', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${WRONG}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });
  });
});
