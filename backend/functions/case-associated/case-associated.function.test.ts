import { EventCaseReference } from '../../../common/src/cams/events';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import handler from './case-associated.function';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import { InvocationContext } from '@azure/functions';

describe('Case summary function', () => {
  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.TrialAttorney],
      },
    }),
  );

  const request = createMockAzureFunctionRequest({
    params: {
      caseId: '000-00-00000',
    },
  });

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('Should return associated cases response.', async () => {
    const expectedResponseBody: CamsResponse<Array<EventCaseReference>> = {
      success: true,
      body: [],
    };
    jest
      .spyOn(CaseAssociatedController.prototype, 'getAssociatedCases')
      .mockResolvedValue(expectedResponseBody);

    const response = await handler(request, context);
    expect(response.status).toEqual(200);
    expect(response.jsonBody).toEqual(expectedResponseBody);
  });

  test('Should return an error response', async () => {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const error = new NotFoundError('CASE-ASSOCIATED-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseAssociatedController.prototype, 'getAssociatedCases').mockRejectedValue(error);
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    const response = await handler(request, context);
    expect(response.status).toEqual(404);
    expect(response.jsonBody).toEqual(expectedErrorResponse);
    expect(httpErrorSpy).toHaveBeenCalledWith(error);
  });
});
