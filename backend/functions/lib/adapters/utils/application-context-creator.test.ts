import { MockUserSessionGateway } from '../../testing/mock-gateways/mock-user-session-gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import ContextCreator from './application-context-creator';
import {
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
  httpRequestToCamsHttpRequest,
} from '../../../azure/functions';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import * as FeatureFlags from './feature-flag';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';

describe('Application Context Creator', () => {
  describe('applicationContextCreator', () => {
    test('should create an application context', async () => {
      const functionContext = createMockAzureFunctionContext();
      const featureFlagsSpy = jest.spyOn(FeatureFlags, 'getFeatureFlags');
      const request = createMockAzureFunctionRequest();
      const context = await ContextCreator.applicationContextCreator(functionContext, request);
      expect(context.logger instanceof Object && 'camsError' in context.logger).toBeTruthy();
      expect(context.config instanceof ApplicationConfiguration).toBeTruthy();
      expect(context.featureFlags instanceof Object).toBeTruthy();
      expect(featureFlagsSpy).toHaveBeenCalled();
      expect(context.request).toEqual(httpRequestToCamsHttpRequest(request));
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
      const request = httpRequestToCamsHttpRequest(createMockAzureFunctionRequest());
      const mockContext = await createMockApplicationContext();
      mockContext.request = request;
      const lookupSpy = jest
        .spyOn(MockUserSessionGateway.prototype, 'lookup')
        .mockResolvedValue(MockData.getCamsSession());
      await ContextCreator.getApplicationContextSession(mockContext);
      expect(lookupSpy).toHaveBeenCalled();
    });
  });
});
