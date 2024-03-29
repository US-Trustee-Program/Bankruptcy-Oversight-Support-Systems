import { EventCaseReference } from '../../../common/src/cams/events';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import httpTrigger from './case-associated.function';

const context = require('azure-function-context-mock');

describe('Case summary function', () => {
  test('Should return associated cases response.', async () => {
    const expectedResponseBody: CamsResponse<Array<EventCaseReference>> = {
      success: true,
      body: [],
    };
    const request = {
      params: {
        caseId: '000-00-00000',
      },
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
    const request = {
      params: {
        caseId: '000-00-00000',
      },
    };
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
