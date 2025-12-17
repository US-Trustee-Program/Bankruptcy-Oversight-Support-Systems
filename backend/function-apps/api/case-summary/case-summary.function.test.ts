import { InvocationContext } from '@azure/functions';
import { CaseDetail } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import handler from './case-summary.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { CaseSummaryController } from '../../../lib/controllers/case-summary/case-summary.controller';

describe('Case summary function', () => {
  jest
    .spyOn(ContextCreator, 'getApplicationContextSession')
    .mockResolvedValue(MockData.getManhattanTrialAttorneySession());

  const baseRequest: Partial<CamsHttpRequest> = {
    method: 'GET',
    params: {
      caseId: '',
    },
  };

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('Should return case summary for an existing case ID', async () => {
    const data: CaseDetail = MockData.getCaseDetail();
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<CaseDetail>({ data });

    const requestObject: Partial<CamsHttpRequest> = {
      ...baseRequest,
      params: {
        caseId: data.caseId,
      },
    };
    const request = createMockAzureFunctionRequest(requestObject);
    jest
      .spyOn(CaseSummaryController.prototype, 'handleRequest')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response for', async () => {
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseSummaryController.prototype, 'handleRequest').mockRejectedValue(error);
    const { azureHttpResponse } = buildTestResponseError(error);

    const requestObject: Partial<CamsHttpRequest> = {
      ...baseRequest,
      params: {
        caseId: '000-00-00000',
      },
    };
    const request = createMockAzureFunctionRequest(requestObject);
    const response = await handler(request, context);
    expect(response.status).toEqual(404);
    expect(response).toEqual(azureHttpResponse);
  });
});
