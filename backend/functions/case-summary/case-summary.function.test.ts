import { CaseDetailInterface } from '../../../common/src/cams/cases';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { CamsResponse } from '../lib/controllers/controller-types';
import httpTrigger from './case-summary.function';

const context = require('azure-function-context-mock');

describe('Case summary function', () => {
  test('Should return case summary for an existing case ID', async () => {
    const caseDetail: CaseDetailInterface = {
      caseId: '',
      courtDivision: '',
      chapter: '',
      caseTitle: '',
      dateFiled: '',
    };
    const expectedResponseBody: CamsResponse<CaseDetailInterface> = {
      success: true,
      body: caseDetail,
    };
    const request = {
      params: {
        caseId: '000-00-00000',
      },
    };
    jest
      .spyOn(CaseSummaryController.prototype, 'getCaseSummary')
      .mockResolvedValue(expectedResponseBody);

    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for', async () => {
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseSummaryController.prototype, 'getCaseSummary').mockRejectedValue(error);
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
