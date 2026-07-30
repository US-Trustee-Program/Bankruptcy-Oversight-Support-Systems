import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import * as FeatureFlags from '../../lib/adapters/utils/feature-flag';
import { testFeatureFlags } from '@common/feature-flags';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { MockUserSessionUseCase } from '../../lib/testing/mock-gateways/mock-user-session-use-case';
import {
  createMockApplicationContext,
  mockObservability,
} from '../../lib/testing/testing-utilities';
import ContextCreator from './application-context-creator';
import { createMockAzureFunctionContext, createMockAzureFunctionRequest } from './testing-helpers';
import { azureToCamsHttpRequest } from './functions';
import { BadRequestError } from '../../lib/common-errors/bad-request';

describe('Application Context Creator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('applicationContextCreator', () => {
    test('should create an application context and call getFeatureFlags exactly once with the resolved session user', async () => {
      const invocationContext = createMockAzureFunctionContext();
      const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
      const request = createMockAzureFunctionRequest();
      const context = await ContextCreator.applicationContextCreator({
        invocationContext,
        observability: mockObservability,
        request,
      });
      expect(context.logger instanceof Object && 'camsError' in context.logger).toBeTruthy();
      expect(context.config instanceof ApplicationConfiguration).toBeTruthy();
      expect(context.request).toEqual(await azureToCamsHttpRequest(request));
      expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
      expect(featureFlagsSpy).toHaveBeenCalledWith(context.config, context.session.user);
      expect(context.featureFlags).toEqual(testFeatureFlags);
    });

    test('should throw an error when attempting to create context with no request', async () => {
      const invocationContext = createMockAzureFunctionContext();
      await expect(
        ContextCreator.applicationContextCreator({
          invocationContext,
          observability: mockObservability,
        }),
      ).rejects.toThrow('Authorization header missing.');
    });

    test('should throw when malicious input is included in request', async () => {
      const maliciousNote = "fetch('/api/data');";
      const invocationContext = createMockAzureFunctionContext();
      const request = createMockAzureFunctionRequest({
        method: 'POST',
        body: {
          malicious: maliciousNote,
        },
      });

      await expect(
        ContextCreator.applicationContextCreator({
          invocationContext,
          observability: mockObservability,
          request,
        }),
      ).rejects.toThrow(
        new BadRequestError(expect.any(String), { message: 'Invalid user input.' }),
      );
    });

    test('should eagerly fetch anonymous feature flags when called directly with no opts', async () => {
      const invocationContext = createMockAzureFunctionContext();
      const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
      const request = createMockAzureFunctionRequest();

      const context = await ContextCreator.getApplicationContext({
        invocationContext,
        observability: mockObservability,
        request,
      });

      expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
      expect(featureFlagsSpy).toHaveBeenCalledWith(context.config);
      expect(context.featureFlags).toEqual(testFeatureFlags);
    });

    test('should reuse an explicitly injected logger instead of building one', async () => {
      const invocationContext = createMockAzureFunctionContext();
      const request = createMockAzureFunctionRequest();
      const injectedLogger = new LoggerImpl('injected-invocation-id');
      const getLoggerSpy = vi.spyOn(ContextCreator, 'getLogger');

      const context = await ContextCreator.getApplicationContext({
        invocationContext,
        observability: mockObservability,
        request,
        logger: injectedLogger,
      });

      expect(context.logger).toBe(injectedLogger);
      expect(getLoggerSpy).not.toHaveBeenCalled();
    });

    test('should resolve observability via the factory singleton when none is injected', async () => {
      vi.resetModules();
      const FreshContextCreator = (await import('./application-context-creator')).default;
      const { NoOpObservability } = await import('../../lib/adapters/services/observability');

      const invocationContext = createMockAzureFunctionContext();
      const request = createMockAzureFunctionRequest();

      const context = await FreshContextCreator.getApplicationContext({
        invocationContext,
        request,
      });

      // DATABASE_MOCK is true in the test environment, so the no-op resolves
      // (applicationinsights is never required).
      expect(context.observability).toBeInstanceOf(NoOpObservability);
    });

    test('should scrub unicode characters', async () => {
      const unicode = 'Hello World 你好 with emoji 🚀';
      const scrubbed = 'Hello World  with emoji ';
      const invocationContext = createMockAzureFunctionContext();
      const originalRequest = createMockAzureFunctionRequest({
        method: 'POST',
        body: {
          unicode,
        },
      });
      const scrubbedBody = {
        unicode: scrubbed,
      };

      const context = await ContextCreator.applicationContextCreator({
        invocationContext,
        observability: mockObservability,
        request: originalRequest,
      });
      expect(context.request.body).toEqual(scrubbedBody);
    });
  });

  describe('getApplicationContextSession', () => {
    let context: ApplicationContext;
    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should throw an UnauthorizedError if authorization header is missing', async () => {
      delete context.request.headers.authorization;
      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Authorization header missing.',
      );
    });

    test('should throw an UnauthorizedError if authorization header is not a bearer token', async () => {
      context.request.headers.authorization = 'shouldthrowError';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError if authorization header contains Bearer but no token', async () => {
      context.request.headers.authorization = 'Bearer ';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError if authorization header contains Bearer with malformed token', async () => {
      context.request.headers.authorization = 'Bearer some-text-that-is-not-possibly-a-valid-jwt';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Malformed Bearer token in authorization header',
      );
    });

    test('should call user session gateway lookup', async () => {
      const request = await azureToCamsHttpRequest(createMockAzureFunctionRequest());
      const mockContext = await createMockApplicationContext();
      mockContext.request = request;
      const lookupSpy = vi
        .spyOn(MockUserSessionUseCase.prototype, 'lookup')
        .mockResolvedValue(MockData.getCamsSession());
      await ContextCreator.getApplicationContextSession(mockContext);
      expect(lookupSpy).toHaveBeenCalled();
    });
  });

  describe('getLogger', () => {
    test('forwards log calls to the invocation context, wrapped in an array', () => {
      const invocationContext = createMockAzureFunctionContext();
      const logSpy = vi.spyOn(invocationContext, 'log');

      const logger = ContextCreator.getLogger(invocationContext);
      logger.info('MODULE', 'a log message');

      expect(logSpy).toHaveBeenCalledWith([
        `[INFO] [MODULE] [INVOCATION ${invocationContext.invocationId}] a log message`,
      ]);
    });
  });
});
