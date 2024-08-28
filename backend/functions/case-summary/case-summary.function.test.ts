import { InvocationContext } from '@azure/functions';
import { CaseDetail } from '../../../common/src/cams/cases';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import handler from './case-summary.function';
import ContextCreator from '../azure/application-context-creator';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import * as httpResponseModule from '../lib/adapters/utils/http-response';

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

  const baseRequest = createMockAzureFunctionRequest({
    method: 'GET',
    params: {
      caseId: '',
    },
  });

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('Should return case summary for an existing case ID', async () => {
    const caseDetail: CaseDetail = MockData.getCaseDetail();

    const expectedResponse: CamsResponse<CaseDetail> = {
      success: true,
      body: caseDetail,
    };
    const request = {
      ...baseRequest,
      params: {
        caseId: '000-00-00000',
      },
    };
    jest
      .spyOn(CaseSummaryController.prototype, 'getCaseSummary')
      .mockResolvedValue(expectedResponse);

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
  });

  test('Should return an error response for', async () => {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseSummaryController.prototype, 'getCaseSummary').mockRejectedValue(error);
    const request = {
      ...baseRequest,
      params: {
        caseId: '000-00-00000',
      },
    };
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
