import { vi } from 'vitest';
import { Request } from 'express';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../lib/adapters/types/basic';
import * as FeatureFlags from '../lib/adapters/utils/feature-flag';
import { testFeatureFlags } from '@common/feature-flags';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
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

  test('should call getFeatureFlags exactly once with the resolved session user', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();

    const context = await ContextCreator.applicationContextCreator(request);

    expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
    expect(featureFlagsSpy).toHaveBeenCalledWith(context.config, context.session.user);
    expect(context.featureFlags).toEqual(testFeatureFlags);
  });

  test('should eagerly fetch anonymous feature flags when getApplicationContext is called directly with no opts', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();
    const logger = ContextCreator.getLogger('test-request-id');

    const context = await ContextCreator.getApplicationContext(request, logger, 'test-request-id');

    expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
    expect(featureFlagsSpy).toHaveBeenCalledWith(context.config);
    expect(context.featureFlags).toEqual(testFeatureFlags);
  });

  test('should skip the eager feature-flag fetch when skipFeatureFlags is true', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();
    const logger = ContextCreator.getLogger('test-request-id');

    const context = await ContextCreator.getApplicationContext(request, logger, 'test-request-id', {
      skipFeatureFlags: true,
    });

    expect(featureFlagsSpy).not.toHaveBeenCalled();
    expect(context.featureFlags).toEqual({});
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

      expect(() => ContextCreator.expressToCamsHttpRequest(request)).toThrow();
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

    test('should throw an UnauthorizedError if authorization header contains Bearer with malformed token', async () => {
      context.request.headers.authorization = 'Bearer some-text-that-is-not-possibly-a-valid-jwt';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Malformed Bearer token in authorization header',
      );
    });
  });
});
