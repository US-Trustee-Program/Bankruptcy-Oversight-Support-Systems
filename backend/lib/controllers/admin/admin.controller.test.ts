import { BadRequestError } from '../../common-errors/bad-request';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminController } from './admin.controller';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsRole } from '../../../../common/src/cams/roles';

describe('Admin controller tests', () => {
  let controller: AdminController;

  beforeEach(async () => {
    controller = new AdminController();
  });

  test('should return 204 for successful deletion of migrations', async () => {
    const context = await createMockApplicationContext();
    context.request.method = 'DELETE';
    context.request.params.procedure = 'deleteMigrations';
    jest.spyOn(AdminUseCase.prototype, 'deleteMigrations').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ statusCode: 204 });
  });

  test('should return 204 for successful deletion of staff', async () => {
    const context = await createMockApplicationContext();
    context.request.method = 'DELETE';
    context.request.params.procedure = 'deleteStaff';
    context.request.body = {
      officeCode: 'TEST_OFFICE_GROUP',
      id: 'user-okta-id',
    };
    jest.spyOn(AdminUseCase.prototype, 'deleteStaff').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ statusCode: 204 });
  });

  test('should return 201 for successful addition of staff', async () => {
    const context = await createMockApplicationContext();
    context.request.method = 'POST';
    context.request.params.procedure = 'createStaff';
    context.request.body = {
      officeCode: 'TEST_OFFICE_GROUP',
      id: 'user-okta-id',
      name: 'Last, First',
      roles: [CamsRole.CaseAssignmentManager],
    };
    jest.spyOn(AdminUseCase.prototype, 'addOfficeStaff').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ statusCode: 201 });
  });

  test('should throw bad request error when procedure does not equal deleteMigrations', async () => {
    const context = await createMockApplicationContext();
    context.request.params.procedure = 'test';
    await expect(() => controller.handleRequest(context)).rejects.toThrow(BadRequestError);
  });

  test('should throw camsError when useCase.deleteMigrations throws', async () => {
    const context = await createMockApplicationContext();
    context.request.method = 'DELETE';
    context.request.params.procedure = 'deleteMigrations';
    jest
      .spyOn(AdminUseCase.prototype, 'deleteMigrations')
      .mockRejectedValue(new Error('test error'));
    await expect(() => controller.handleRequest(context)).rejects.toThrow(UnknownError);
  });
});
