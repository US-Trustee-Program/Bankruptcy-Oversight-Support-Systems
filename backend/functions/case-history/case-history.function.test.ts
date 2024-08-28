import { CASE_HISTORY } from '../lib/testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import handler from './case-history.function';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { buildResponseBodySuccess } from '../../../common/src/api/response';
import { CaseHistory } from '../../../common/src/cams/history';
import { CaseHistoryController } from '../lib/controllers/case-history/case-history.controller';

describe('Case History Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'GET',
    params: {
      caseId: '',
    },
  };

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.CaseAssignmentManager],
      },
    }),
  );

  test('Should return case history for an existing case ID', async () => {
    const caseId = NORMAL_CASE_ID;
    const requestOverride: Partial<CamsHttpRequest> = {
      params: {
        caseId,
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const controllerResponse = buildResponseBodySuccess<CaseHistory[]>(CASE_HISTORY, {
      isPaginated: false,
      self: request.url,
    });

    jest
      .spyOn(CaseHistoryController.prototype, 'getCaseHistory')
      .mockResolvedValue(controllerResponse);

    const expectedResponse = {
      isSuccess: true,
      meta: expect.any(Object),
      data: CASE_HISTORY,
    };

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    jest
      .spyOn(CaseHistoryController.prototype, 'getCaseHistory')
      .mockRejectedValue(new NotFoundError('test-module'));

    const requestOverride = {
      params: {
        caseId: NOT_FOUND_ERROR_CASE_ID,
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedErrorResponse = {
      success: false,
      message: 'Not found',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedErrorResponse);
    expect(response.status).toEqual(404);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
