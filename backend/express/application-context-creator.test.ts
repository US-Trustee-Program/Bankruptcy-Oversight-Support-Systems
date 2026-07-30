import { vi } from 'vitest';
import { Request } from 'express';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../lib/adapters/types/basic';
import * as FeatureFlags from '../lib/adapters/utils/feature-flag';
import { testFeatureFlags } from '@common/feature-flags';
import { CamsError } from '../lib/common-errors/cams-error';
import factory from '../lib/factory';
import ContextCreator from './application-context-creator';

type MockExpressRequestOverrides = {
  method?: string;
  secure?: boolean;
  host?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string | string[]>;
};

function createMockExpressRequest(overrides: MockExpressRequestOverrides = {}): Request {
  const host = overrides.host ?? 'localhost:7071';
  return {
    method: overrides.method ?? 'GET',
    url: '/cases',
    secure: overrides.secure ?? false,
    get: (field: string): string | undefined => (field === 'host' ? host : undefined),
    query: overrides.query ?? {},
    params: overrides.params ?? {},
    body: overrides.body,
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...overrides.headers },
  } as Partial<Request> as Request;
}

describe('Express Application Context Creator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should resolve the session and reconcile feature flags to the authenticated user', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();

    const context = await ContextCreator.applicationContextCreator(request);

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
    const request = createMockExpressRequest();

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

    await ContextCreator.applicationContextCreator(request);

    expect(flagsSeenDuringLookup).toEqual(testFeatureFlags);
  });

  test('should populate feature flags when getApplicationContext is called directly', async () => {
    const request = createMockExpressRequest();
    const logger = ContextCreator.getLogger('test-request-id');

    const context = await ContextCreator.getApplicationContext(request, logger, 'test-request-id');

    expect(context.featureFlags).toEqual(testFeatureFlags);
  });

  describe('expressToCamsHttpRequest', () => {
    test('joins array-valued headers and builds a secure URL', () => {
      const request = createMockExpressRequest({
        method: 'POST',
        secure: true,
        host: 'example.com',
        query: { foo: 'bar' },
        params: { id: '123' },
        body: { some: 'body' },
        headers: { 'x-multi': ['a', 'b'], authorization: 'Bearer token' },
      });

      const camsRequest = ContextCreator.expressToCamsHttpRequest(request);

      expect(camsRequest).toEqual({
        method: 'POST',
        url: 'https://example.com/cases',
        headers: { 'x-multi': 'a, b', authorization: 'Bearer token' },
        query: { foo: 'bar' },
        params: { id: '123' },
        body: { some: 'body' },
      });
    });

    test('falls back to localhost:7071 when no host header is present', () => {
      const request = createMockExpressRequest({ headers: { authorization: 'Bearer token' } });

      const camsRequest = ContextCreator.expressToCamsHttpRequest(request);

      expect(camsRequest.url).toEqual('http://localhost:7071/cases');
    });

    test('wraps an unexpected error via getCamsError', () => {
      const request = {
        get headers(): Request['headers'] {
          throw new Error('boom');
        },
      } as Partial<Request> as Request;

      expect(() => ContextCreator.expressToCamsHttpRequest(request)).toThrow(expect.any(CamsError));
    });
  });

  describe('getLogger', () => {
    test('forwards log calls to console.log, prefixed with the request id', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = ContextCreator.getLogger('test-request-id');
      logger.info('MODULE', 'a log message');

      expect(logSpy).toHaveBeenCalledWith(
        '[test-request-id]',
        '[INFO] [MODULE] [INVOCATION test-request-id] a log message',
      );
    });
  });
});
