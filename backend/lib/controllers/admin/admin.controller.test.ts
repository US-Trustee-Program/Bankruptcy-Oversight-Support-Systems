import { BadRequestError } from '../../common-errors/bad-request';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminController } from './admin.controller';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { UnknownError } from '../../common-errors/unknown-error';

describe('Admin controller tests', () => {
  let controller: AdminController;

  beforeEach(async () => {
    controller = new AdminController();
  });

  test('should return 204 for successful deletion', async () => {
    const context = await createMockApplicationContext();
    context.request.params.procedure = 'deleteMigrations';
    jest.spyOn(AdminUseCase.prototype, 'deleteMigrations').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ statusCode: 204 });
  });

  test('should throw bad request error when procedure does not equal deleteMigrations', async () => {
    const context = await createMockApplicationContext();
    context.request.params.procedure = 'test';
    await expect(() => controller.handleRequest(context)).rejects.toThrow(BadRequestError);
  });

  test('should throw camsError when useCase.deleteMigrations throws', async () => {
    const context = await createMockApplicationContext();
    context.request.params.procedure = 'deleteMigrations';
    jest
      .spyOn(AdminUseCase.prototype, 'deleteMigrations')
      .mockRejectedValue(new Error('test error'));
    await expect(() => controller.handleRequest(context)).rejects.toThrow(UnknownError);
  });
});
