import { vi } from 'vitest';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import StaffUseCase from '../../use-cases/staff/staff';
import { NotFoundError } from '../../common-errors/not-found-error';
import { StaffController } from './staff.controller';
import { ApplicationContext } from '../../adapters/types/basic';

describe('Staff Controller Tests', () => {
  let context: ApplicationContext;
  let controller: StaffController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    controller = new StaffController(context);
  });

  test('should return success if oversight staff are found', async () => {
    const staffList = [
      ...MockData.buildArray(MockData.getAttorneyUser, 3),
      ...MockData.buildArray(MockData.getAuditorUser, 2),
    ];

    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue(staffList);
    const response = await controller.handleRequest(context);
    expect(response).toEqual(
      expect.objectContaining({
        body: { data: staffList },
        headers: expect.anything(),
        statusCode: 200,
      }),
    );
  });

  test('should throw NotFound error if staff are not found', async () => {
    const error = new NotFoundError('STAFF-USE-CASE', {
      message: 'Staff not found.',
    });
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow('Unknown Error');
  });
});
