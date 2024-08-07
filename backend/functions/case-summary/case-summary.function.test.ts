import { CaseDetail } from '../../../common/src/cams/cases';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import httpTrigger from './case-summary.function';

describe('Case summary function', () => {
  const request = createMockAzureFunctionRequest({
    method: 'GET',
    params: {
      caseId: '',
    },
  });

  const context = require('azure-function-context-mock');

  test('Should return case summary for an existing case ID', async () => {
    const caseDetail: CaseDetail = MockData.getCaseDetail();

    const expectedResponseBody: CamsResponse<CaseDetail> = {
      success: true,
      body: caseDetail,
    };
    const requestOverride = {
      ...request,
      params: {
        caseId: '000-00-00000',
      },
    };
    jest
      .spyOn(CaseSummaryController.prototype, 'getCaseSummary')
      .mockResolvedValue(expectedResponseBody);

    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for', async () => {
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseSummaryController.prototype, 'getCaseSummary').mockRejectedValue(error);
    const requestOverride = {
      ...request,
      params: {
        caseId: '000-00-00000',
      },
    };
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
