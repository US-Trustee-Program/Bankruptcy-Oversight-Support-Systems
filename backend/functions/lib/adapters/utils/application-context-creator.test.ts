import { MockUserSessionGateway } from '../../testing/mock-gateways/mock-user-session-gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import ContextCreator from './application-context-creator';
import {
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../../azure/functions';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import * as FeatureFlags from './feature-flag';

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
      expect(context.req).toEqual(request);
    });
  });

  describe('getApplicationContextSession', () => {
    let context: ApplicationContext;
    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should throw an UnauthorizedError if authorization header is missing', async () => {
      delete context.req.headers.authorization;
      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Authorization header missing.',
      );
    });

    test('should throw an UnauthorizedError if authorization header is not a bearer token', async () => {
      context.req.headers.authorization = 'shouldthrowError';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should throw an UnauthorizedError if authorization header contains Bearer but no token', async () => {
      context.req.headers.authorization = 'Bearer ';

      await expect(ContextCreator.getApplicationContextSession(context)).rejects.toThrow(
        'Bearer token not found in authorization header',
      );
    });

    test('should call user session gateway lookup', async () => {
      const lookupSpy = jest.spyOn(MockUserSessionGateway.prototype, 'lookup');
      await ContextCreator.getApplicationContextSession(context);
      expect(lookupSpy).toHaveBeenCalled();
    });
  });
});
