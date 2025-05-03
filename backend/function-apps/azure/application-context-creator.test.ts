import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import * as FeatureFlags from '../../lib/adapters/utils/feature-flag';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { MockUserSessionUseCase } from '../../lib/testing/mock-gateways/mock-user-session-use-case';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import ContextCreator from './application-context-creator';
import { azureToCamsHttpRequest } from './functions';
import { createMockAzureFunctionContext, createMockAzureFunctionRequest } from './testing-helpers';

describe('Application Context Creator', () => {
  describe('applicationContextCreator', () => {
    test('should create an application context', async () => {
      const invocationContext = createMockAzureFunctionContext();
      const featureFlagsSpy = jest.spyOn(FeatureFlags, 'getFeatureFlags');
      const request = createMockAzureFunctionRequest();
      const context = await ContextCreator.applicationContextCreator({
        invocationContext,
        request,
      });
      expect(context.logger instanceof Object && 'camsError' in context.logger).toBeTruthy();
      expect(context.config instanceof ApplicationConfiguration).toBeTruthy();
      expect(context.featureFlags instanceof Object).toBeTruthy();
      expect(featureFlagsSpy).toHaveBeenCalled();
      expect(context.request).toEqual(await azureToCamsHttpRequest(request));
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
      const lookupSpy = jest
        .spyOn(MockUserSessionUseCase.prototype, 'lookup')
        .mockResolvedValue(MockData.getCamsSession());
      await ContextCreator.getApplicationContextSession(mockContext);
      expect(lookupSpy).toHaveBeenCalled();
    });
  });
});
