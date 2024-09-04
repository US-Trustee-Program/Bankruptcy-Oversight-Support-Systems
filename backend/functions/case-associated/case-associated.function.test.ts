import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import handler from './case-associated.function';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { EventCaseReference } from '../../../common/src/cams/events';

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
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<EventCaseReference[]>({
      data: [],
    });
    jest
      .spyOn(CaseAssociatedController.prototype, 'getAssociatedCases')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response', async () => {
    const error = new NotFoundError('CASE-ASSOCIATED-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseAssociatedController.prototype, 'getAssociatedCases').mockRejectedValue(error);

    const { azureHttpResponse } = buildTestResponseError(error);

    const response = await handler(request, context);
    expect(response.status).toEqual(azureHttpResponse.status);
    expect(response.jsonBody).toEqual(azureHttpResponse.jsonBody);
  });
});
