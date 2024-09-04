import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseManagement from '../../use-cases/case-management';
import { NotFoundError } from '../../common-errors/not-found-error';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { CaseSummaryController } from './case-summary.controller';

describe('Test case-summary controller', () => {
  let applicationContext;
  let controller;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    controller = new CaseSummaryController(applicationContext);
  });

  test('should return success if case summary is found', async () => {
    const caseDetail = MockData.getCaseDetail();

    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(caseDetail);
    const request = mockCamsHttpRequest({ params: { caseId: caseDetail.caseId } });
    const response = await controller.getCaseSummary(applicationContext, request);
    expect(response).toEqual(
      expect.objectContaining({
        body: { meta: expect.objectContaining({ self: expect.any(String) }), data: caseDetail },
      }),
    );
  });

  test('should throw NotFound error if case summary is not found', async () => {
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    const request = mockCamsHttpRequest({ params: { caseId: '000-00-00000' } });
    await expect(controller.getCaseSummary(applicationContext, request)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    const request = mockCamsHttpRequest({ params: { caseId: '000-00-00000' } });
    await expect(controller.getCaseSummary(applicationContext, request)).rejects.toThrow(
      'Unknown error',
    );
  });
});
