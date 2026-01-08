import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseManagement from '../../use-cases/cases/case-management';
import { NotFoundError } from '../../common-errors/not-found-error';
import MockData from '@common/cams/test-utilities/mock-data';
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

    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(caseDetail);
    const response = await controller.handleRequest(applicationContext);
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
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(error);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow('Unknown Error');
  });
});
