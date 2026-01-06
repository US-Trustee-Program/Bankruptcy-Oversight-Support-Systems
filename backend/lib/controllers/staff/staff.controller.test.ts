import { vi } from 'vitest';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import StaffUseCase from '../../use-cases/staff/staff';
import { NotFoundError } from '../../common-errors/not-found-error';
import { StaffController } from './staff.controller';
import { ApplicationContext } from '../../adapters/types/basic';
import { Staff } from '../../../../common/src/cams/users';
import { CamsRole, OversightRoleType } from '../../../../common/src/cams/roles';

describe('Staff Controller Tests', () => {
  let context: ApplicationContext;
  let controller: StaffController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    controller = new StaffController(context);
  });

  test('should return oversight staff in Record structure', async () => {
    const mockData: Record<OversightRoleType, Staff[]> = {
      [CamsRole.TrialAttorney]: [
        { id: 'u1', name: 'Attorney 1', roles: [CamsRole.TrialAttorney] },
        { id: 'u2', name: 'Attorney 2', roles: [CamsRole.TrialAttorney] },
        { id: 'u3', name: 'Attorney 3', roles: [CamsRole.TrialAttorney] },
      ],
      [CamsRole.Auditor]: [
        { id: 'u4', name: 'Auditor 1', roles: [CamsRole.Auditor] },
        { id: 'u5', name: 'Auditor 2', roles: [CamsRole.Auditor] },
      ],
      [CamsRole.Paralegal]: [
        { id: 'u6', name: 'Paralegal 1', roles: [CamsRole.Paralegal] },
      ],
    };

    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue(mockData);
    const response = await controller.handleRequest(context);
    expect(response).toEqual(
      expect.objectContaining({
        body: { data: mockData },
        headers: expect.anything(),
        statusCode: 200,
      }),
    );
  });

  test('should handle use case errors', async () => {
    const mockError = new Error('Database error');
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(mockError);
    await expect(controller.handleRequest(context)).rejects.toThrow('Unknown Error');
  });

  test('should handle NotFound errors', async () => {
    const error = new NotFoundError('STAFF-USE-CASE', {
      message: 'Staff not found.',
    });
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow(error);
  });
});
