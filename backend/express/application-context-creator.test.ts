import { vi } from 'vitest';
import { Request } from 'express';
import MockData from '@common/cams/test-utilities/mock-data';
import * as FeatureFlags from '../lib/adapters/utils/feature-flag';
import ContextCreator from './application-context-creator';

function createMockExpressRequest(headers: Record<string, string> = {}): Request {
  return {
    method: 'GET',
    url: '/cases',
    secure: false,
    get: (field: string): string | undefined => (field === 'host' ? 'localhost:7071' : undefined),
    query: {},
    params: {},
    body: undefined,
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
  } as Partial<Request> as Request;
}

describe('Express Application Context Creator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call getFeatureFlags exactly once with the resolved session user', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();

    const context = await ContextCreator.applicationContextCreator(request);

    expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
    expect(featureFlagsSpy).toHaveBeenCalledWith(context.config, context.session.user);
  });

  test('should eagerly fetch anonymous feature flags when getApplicationContext is called directly with no opts', async () => {
    const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');
    const request = createMockExpressRequest();
    const logger = ContextCreator.getLogger('test-request-id');

    const context = await ContextCreator.getApplicationContext(request, logger, 'test-request-id');

    expect(featureFlagsSpy).toHaveBeenCalledTimes(1);
    expect(featureFlagsSpy).toHaveBeenCalledWith(context.config);
    expect(context.featureFlags).toBeInstanceOf(Object);
  });
});
