import { Request } from 'express';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import * as FeatureFlags from '../../lib/adapters/utils/feature-flag';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { MockUserSessionUseCase } from '../../lib/testing/mock-gateways/mock-user-session-use-case';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import ContextCreator from './application-context-creator';
import { expressToCamsHttpRequest } from './functions';
import { BadRequestError } from '../../lib/common-errors/bad-request';

// Helper to create mock Express request
function createMockExpressRequest(overrides?: Partial<Request>): Request {
  return {
    method: 'GET',
    url: '/test',
    originalUrl: '/test',
    headers: {
      authorization: 'Bearer ' + MockData.getCamsSession().accessToken,
    },
    query: {},
    params: {},
    body: undefined,
    ...overrides,
  } as Request;
}

describe('Express Application Context Creator', () => {
  describe('applicationContextCreator', () => {
    test('should create an application context', async () => {
      const featureFlagsSpy = jest.spyOn(FeatureFlags, 'getFeatureFlags');
      const request = createMockExpressRequest();
      const context = await ContextCreator.applicationContextCreator({
        request,
      });
      expect(context.logger instanceof Object && 'camsError' in context.logger).toBeTruthy();
      expect(context.config instanceof ApplicationConfiguration).toBeTruthy();
      expect(context.featureFlags instanceof Object).toBeTruthy();
      expect(featureFlagsSpy).toHaveBeenCalled();
      expect(context.request).toEqual(expressToCamsHttpRequest(request));
    });

    test('should create context without request', async () => {
      const context = await ContextCreator.getApplicationContext({});
      expect(context.logger instanceof Object && 'camsError' in context.logger).toBeTruthy();
      expect(context.config instanceof ApplicationConfiguration).toBeTruthy();
      expect(context.featureFlags instanceof Object).toBeTruthy();
      expect(context.request).toBeUndefined();
    });

    test('should throw when malicious input is included in request', async () => {
      const maliciousNote = "fetch('/api/data');";
      const request = createMockExpressRequest({
        method: 'POST',
        body: {
          malicious: maliciousNote,
        },
      });

      await expect(
        ContextCreator.applicationContextCreator({
          request,
        }),
      ).rejects.toThrow(
        new BadRequestError(expect.any(String), { message: 'Invalid user input.' }),
      );
    });

    test('should scrub unicode characters', async () => {
      const unicode = 'Hello World 你好 with emoji 🚀';
      const scrubbed = 'Hello World  with emoji ';
      const originalRequest = createMockExpressRequest({
        method: 'POST',
        body: {
          unicode,
        },
      });
      const scrubbedBody = {
        unicode: scrubbed,
      };

      const context = await ContextCreator.applicationContextCreator({
        request: originalRequest,
      });
      expect(context.request?.body).toEqual(scrubbedBody);
    });
  });

  describe('getApplicationContextSession', () => {
    let context: ApplicationContext;
    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should throw an UnauthorizedError if there is no request', async () => {
      delete context.request;
      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Authorization header missing.',
      );
    });

    test('should throw an UnauthorizedError if authorization header is missing', async () => {
      delete context.request?.headers.authorization;
      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Authorization header missing.',
      );
    });

    test('should throw an UnauthorizedError if authorization header is not a bearer token', async () => {
      if (context.request) {
        context.request.headers.authorization = 'shouldthrowError';
      }

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError if authorization header contains Bearer but no token', async () => {
      if (context.request) {
        context.request.headers.authorization = 'Bearer ';
      }

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError if authorization header contains Bearer with malformed token', async () => {
      if (context.request) {
        context.request.headers.authorization = 'Bearer some-text-that-is-not-possibly-a-valid-jwt';
      }

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Malformed Bearer token in authorization header',
      );
    });

    test('should call user session gateway lookup', async () => {
      const request = expressToCamsHttpRequest(createMockExpressRequest());
      const mockContext = await createMockApplicationContext();
      mockContext.request = request;
      const lookupSpy = jest
        .spyOn(MockUserSessionUseCase.prototype, 'lookup')
        .mockResolvedValue(MockData.getCamsSession());
      await ContextCreator.getApplicationContextSession(mockContext);
      expect(lookupSpy).toHaveBeenCalled();
    });
  });
});
