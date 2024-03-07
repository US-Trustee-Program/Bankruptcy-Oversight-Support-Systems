import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseSummaryController } from './case-summary.controller';
import { CaseManagement } from '../../use-cases/case-management';
import { NotFoundError } from '../../common-errors/not-found-error';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';

describe('Test case-summary controller', () => {
  let applicationContext;
  let controller;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    controller = new CaseSummaryController(applicationContext);
  });

  test('should return success if case summary is found', async () => {
    const caseDetail = MockData.getCaseDetail();

    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(caseDetail);
    const response = await controller.getCaseSummary(applicationContext, caseDetail.caseId);
    expect(response).toEqual({ success: true, body: caseDetail });
  });

  test('should throw NotFound error if case summary is not found', async () => {
    const error = new NotFoundError('CASE-MANAGEMENT-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    await expect(controller.getCaseSummary(applicationContext, '000-00-00000')).rejects.toThrow(
      error,
    );
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    await expect(controller.getCaseSummary(applicationContext, '000-00-00000')).rejects.toThrow(
      'Unknown error',
    );
  });
});
