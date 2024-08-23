import { InvocationContext } from '@azure/functions';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AnyCondition, buildFunctionHandler } from './buildFunctionHandler';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { CamsError } from '../lib/common-errors/cams-error';
import { ForbiddenError } from '../lib/common-errors/forbidden-error';
import { ServerConfigError } from '../lib/common-errors/server-config-error';
import { UnauthorizedError } from '../lib/common-errors/unauthorized-error';
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  UNAUTHORIZED,
} from '../lib/common-errors/constants';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';

describe('buildFunctionHandler', () => {
  const MODULE_NAME = 'TEST';
  const request = createMockAzureFunctionRequest({
    method: 'GET',
    params: {
      caseId: '',
    },
  });
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  async function testError(error: Error, status: number) {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    const handler = buildFunctionHandler(MODULE_NAME, [
      {
        if: AnyCondition,
        then: jest.fn().mockRejectedValue(error),
      },
    ]);
    const response = await handler(request, context);
    expect(response.status).toEqual(status);
    expect(response.jsonBody).toEqual(expectedErrorResponse);
    expect(httpErrorSpy).toHaveBeenCalledWith(error);
  }

  test('should return BadRequestError as error response', async () => {
    testError(new BadRequestError(MODULE_NAME), BAD_REQUEST);
  });

  test('should return CamsError as error response', async () => {
    testError(new CamsError(MODULE_NAME), INTERNAL_SERVER_ERROR);
  });

  test('should return ForbiddenError as error response', async () => {
    testError(new ForbiddenError(MODULE_NAME), FORBIDDEN);
  });

  test('should return NotFoundError as error response', async () => {
    testError(new NotFoundError(MODULE_NAME), NOT_FOUND);
  });

  test('should return ServerConfigError as error response', async () => {
    testError(new ServerConfigError(MODULE_NAME), INTERNAL_SERVER_ERROR);
  });

  test('should return UnauthorizedError as error response', async () => {
    testError(new UnauthorizedError(MODULE_NAME), UNAUTHORIZED);
  });

  test('should return UnknownError as error response', async () => {
    testError(new UnknownError(MODULE_NAME), INTERNAL_SERVER_ERROR);
  });

  test('should return ServerConfigError if an empty list of conditions and actions are provided', async () => {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const error = new ServerConfigError(MODULE_NAME, {
      message: 'No matching condition for request',
    });
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    const handler = buildFunctionHandler(MODULE_NAME, []);
    const response = await handler(request, context);
    expect(response.status).toEqual(error.status);
    expect(response.jsonBody).toEqual(expectedErrorResponse);
    expect(httpErrorSpy).toHaveBeenCalledWith(error);
  });

  test('should return call the action for a matched condition', async () => {
    const session = MockData.getCamsSession();
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(session);

    const applicationContext = await ContextCreator.applicationContextCreator(context, request);
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);
    const expectedApplicationContext = { ...applicationContext, logger: expect.anything() };

    const httpSuccessSpy = jest.spyOn(httpResponseModule, 'httpSuccess');
    const expectedResponse = {
      foo: 'bar',
    };

    const actionSpy = jest.fn().mockResolvedValue(expectedResponse);
    const handler = buildFunctionHandler(MODULE_NAME, [
      {
        if: AnyCondition,
        then: actionSpy,
      },
    ]);
    const response = await handler(request, context);

    expect(response.status).toEqual(200);
    expect(response.jsonBody).toEqual(expectedResponse);

    expect(httpSuccessSpy).toHaveBeenCalledWith(expectedResponse);
    expect(actionSpy).toHaveBeenCalledWith(expectedApplicationContext);
  });
});
