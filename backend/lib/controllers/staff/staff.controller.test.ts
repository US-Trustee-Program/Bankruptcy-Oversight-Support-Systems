import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import StaffUseCase from '../../use-cases/staff/staff';
import { NotFoundError } from '../../common-errors/not-found-error';
import { StaffController } from './staff.controller';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsUserReference } from '../../../../common/src/cams/users';

describe('Staff Controller Tests', () => {
  let context: ApplicationContext;
  let controller: StaffController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    controller = new StaffController(context);
  });

  test('should return success with oversight staff grouped by role', async () => {
    const oversightStaff: Record<string, CamsUserReference[]> = {
      TrialAttorney: MockData.buildArray(MockData.getCamsUserReference, 3),
      Auditor: MockData.buildArray(MockData.getCamsUserReference, 2),
      Paralegal: MockData.buildArray(MockData.getCamsUserReference, 1),
    };

    jest.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue(oversightStaff);
    const response = await controller.handleRequest(context);
    expect(response).toEqual(
      expect.objectContaining({
        body: { data: oversightStaff },
        headers: expect.anything(),
        statusCode: 200,
      }),
    );
  });

  test('should return success with empty Record when no staff found', async () => {
    const emptyStaff: Record<string, CamsUserReference[]> = {};

    jest.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue(emptyStaff);
    const response = await controller.handleRequest(context);
    expect(response).toEqual(
      expect.objectContaining({
        body: { data: emptyStaff },
        headers: expect.anything(),
        statusCode: 200,
      }),
    );
  });

  test('should throw NotFound error if staff are not found', async () => {
    const error = new NotFoundError('STAFF-USE-CASE', {
      message: 'Staff not found.',
    });
    jest.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    jest.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow('Unknown Error');
  });
});
