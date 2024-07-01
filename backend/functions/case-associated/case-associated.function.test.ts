import { EventCaseReference } from '../../../common/src/cams/events';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import httpTrigger from './case-associated.function';

describe('Case summary function', () => {
  const request = createMockAzureFunctionRequest({
    params: {
      caseId: '000-00-00000',
    },
  });

  const context = require('azure-function-context-mock');

  test('Should return associated cases response.', async () => {
    const expectedResponseBody: CamsResponse<Array<EventCaseReference>> = {
      success: true,
      body: [],
    };
    jest
      .spyOn(CaseAssociatedController.prototype, 'getAssociatedCases')
      .mockResolvedValue(expectedResponseBody);

    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response', async () => {
    const error = new NotFoundError('CASE-ASSOCIATED-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseAssociatedController.prototype, 'getAssociatedCases').mockRejectedValue(error);
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
