import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { testFeatureFlags } from '@common/feature-flags';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import * as FeatureFlags from './feature-flag';
import { finalizeApplicationContext, getApplicationContextSession } from './application-context';

const MODULE_NAME = 'TEST-MODULE';

describe('application-context helpers', () => {
  describe('getApplicationContextSession', () => {
    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should throw an UnauthorizedError when the authorization header is missing', async () => {
      delete context.request.headers.authorization;
      await expect(getApplicationContextSession(context, MODULE_NAME)).rejects.toThrow(
        'Authorization header missing.',
      );
    });

    test('should throw an UnauthorizedError when the header is not a bearer token', async () => {
      context.request.headers.authorization = 'shouldthrowError';
      await expect(getApplicationContextSession(context, MODULE_NAME)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError when the bearer token is empty', async () => {
      context.request.headers.authorization = 'Bearer ';
      await expect(getApplicationContextSession(context, MODULE_NAME)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError when the bearer token is malformed', async () => {
      context.request.headers.authorization = 'Bearer some-text-that-is-not-possibly-a-valid-jwt';
      await expect(getApplicationContextSession(context, MODULE_NAME)).rejects.toThrow(
        'Malformed Bearer token in authorization header',
      );
    });

    test('should resolve the session via the user session use case', async () => {
      const session = MockData.getCamsSession();
      const useCase = factory.getUserSessionUseCase(context);
      const lookupSpy = vi.spyOn(useCase, 'lookup').mockResolvedValue(session);
      vi.spyOn(factory, 'getUserSessionUseCase').mockReturnValue(useCase);

      const result = await getApplicationContextSession(context, MODULE_NAME);

      expect(lookupSpy).toHaveBeenCalled();
      expect(result).toEqual(session);
    });
  });

  describe('finalizeApplicationContext', () => {
    test('should resolve the session with feature flags available to it', async () => {
      // Regression guard (CAMS-810): session resolution reads feature flags for
      // PIM role elevation, so the flags present on the incoming context must
      // still be visible when the session is resolved — never an empty set.
      const context = await createMockApplicationContext();
      context.featureFlags = { ...testFeatureFlags };

      let flagsSeenDuringLookup: ApplicationContext['featureFlags'] | undefined;
      const useCase = factory.getUserSessionUseCase(context);
      vi.spyOn(useCase, 'lookup').mockImplementation(async (ctx) => {
        flagsSeenDuringLookup = { ...ctx.featureFlags };
        return MockData.getCamsSession();
      });
      vi.spyOn(factory, 'getUserSessionUseCase').mockReturnValue(useCase);

      await finalizeApplicationContext(context, MODULE_NAME);

      expect(flagsSeenDuringLookup).toEqual(testFeatureFlags);
    });

    test('should reconcile feature flags to the authenticated user and return the context', async () => {
      const context = await createMockApplicationContext();
      const featureFlagsSpy = vi.spyOn(FeatureFlags, 'getFeatureFlags');

      const result = await finalizeApplicationContext(context, MODULE_NAME);

      expect(result.session).toBeDefined();
      expect(featureFlagsSpy).toHaveBeenCalledWith(context.config, result.session.user);
      expect(result.featureFlags).toEqual(testFeatureFlags);
    });
  });
});
