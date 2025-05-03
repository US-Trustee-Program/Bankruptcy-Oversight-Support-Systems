import { InvocationContext } from '@azure/functions';

import { EventCaseReference } from '../../../../common/src/cams/events';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../../../lib/controllers/case-associated/case-associated.controller';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './case-associated.function';

describe('Case summary function', () => {
  jest
    .spyOn(ContextCreator, 'getApplicationContextSession')
    .mockResolvedValue(MockData.getManhattanTrialAttorneySession());

  const request = createMockAzureFunctionRequest({
    params: {
      caseId: '000-00-00000',
    },
  });

  const context = new InvocationContext({
    invocationId: 'id',
    logHandler: () => {},
  });

  test('Should return associated cases response.', async () => {
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<EventCaseReference[]>({
      data: [],
    });
    jest
      .spyOn(CaseAssociatedController.prototype, 'handleRequest')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response', async () => {
    const error = new NotFoundError('CASE-ASSOCIATED-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseAssociatedController.prototype, 'handleRequest').mockRejectedValue(error);

    const { azureHttpResponse } = buildTestResponseError(error);

    const response = await handler(request, context);
    expect(response.status).toEqual(azureHttpResponse.status);
    expect(response.jsonBody).toEqual(azureHttpResponse.jsonBody);
  });
});
