import { vi } from 'vitest';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CaseAssociatedController } from '../../../lib/controllers/case-associated/case-associated.controller';
import handler from './case-associated.function';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '@common/cams/test-utilities/mock-data';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { EventCaseReference } from '@common/cams/events';

describe('Case summary function', () => {
  vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getManhattanTrialAttorneySession(),
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
    vi.spyOn(CaseAssociatedController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response', async () => {
    const error = new NotFoundError('CASE-ASSOCIATED-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    vi.spyOn(CaseAssociatedController.prototype, 'handleRequest').mockRejectedValue(error);

    const { azureHttpResponse } = buildTestResponseError(error);

    const response = await handler(request, context);
    expect(response.status).toEqual(azureHttpResponse.status);
    expect(response.jsonBody).toEqual(azureHttpResponse.jsonBody);
  });
});
