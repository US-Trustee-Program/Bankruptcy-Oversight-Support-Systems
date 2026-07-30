import { vi } from 'vitest';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import * as FeatureFlags from '../../lib/adapters/utils/feature-flag';
import { testFeatureFlags } from '@common/feature-flags';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { mockObservability } from '../../lib/testing/testing-utilities';
import factory from '../../lib/factory';
import ContextCreator from './application-context-creator';
import { createMockAzureFunctionContext, createMockAzureFunctionRequest } from './testing-helpers';
import { azureToCamsHttpRequest } from './functions';
import { BadRequestError } from '../../lib/common-errors/bad-request';

describe('Application Context Creator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('applicationContextCreator', () => {
    test('should create an application context, resolving the session and reconciling feature flags to the authenticated user', async () => {
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
      expect(context.session).toBeDefined();
      // Flags on the finished context reflect the authenticated user, not an
      // anonymous evaluation.
      expect(featureFlagsSpy).toHaveBeenCalledWith(context.config, context.session.user);
      expect(context.featureFlags).toEqual(testFeatureFlags);
    });

    test('should resolve the session with feature flags available to it', async () => {
      // Regression guard (CAMS-810): PIM role elevation during session resolution
      // is gated on a feature flag, so the session must be resolved with flags
      // populated rather than an empty set.
      const invocationContext = createMockAzureFunctionContext();
      const request = createMockAzureFunctionRequest();

      let flagsSeenDuringLookup: ApplicationContext['featureFlags'] | undefined;
      const realUseCaseFactory = factory.getUserSessionUseCase;
      vi.spyOn(factory, 'getUserSessionUseCase').mockImplementation((context) => {
        const useCase = realUseCaseFactory(context);
        const realLookup = useCase.lookup.bind(useCase);
        vi.spyOn(useCase, 'lookup').mockImplementation(async (ctx, token) => {
          flagsSeenDuringLookup = { ...ctx.featureFlags };
          return realLookup(ctx, token);
        });
        return useCase;
      });

      await ContextCreator.applicationContextCreator({
        invocationContext,
        observability: mockObservability,
        request,
      });

      expect(flagsSeenDuringLookup).toEqual(testFeatureFlags);
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

    test('should populate feature flags when getApplicationContext is called directly', async () => {
      const invocationContext = createMockAzureFunctionContext();
      const request = createMockAzureFunctionRequest();

      const context = await ContextCreator.getApplicationContext({
        invocationContext,
        observability: mockObservability,
        request,
      });

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
