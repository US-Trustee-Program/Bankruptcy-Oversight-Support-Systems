import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import StaffUseCase from '../../use-cases/staff/staff';
import { NotFoundError } from '../../common-errors/not-found-error';
import { StaffController } from './staff.controller';
import { ApplicationContext } from '../../use-cases/application.types';

describe('Attorneys Controller Tests', () => {
  let context: ApplicationContext;
  let controller: StaffController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    controller = new StaffController(context);
  });

  test('should return success if staff are found', async () => {
    const attorneyList = MockData.buildArray(MockData.getAttorneyUser, 5);

    jest.spyOn(StaffUseCase.prototype, 'getAttorneyList').mockResolvedValue(attorneyList);
    const response = await controller.handleRequest(context);
    expect(response).toEqual(
      expect.objectContaining({
        body: { data: attorneyList },
        headers: expect.anything(),
        statusCode: 200,
      }),
    );
  });

  test('should throw NotFound error if case summary is not found', async () => {
    const error = new NotFoundError('ATTORNEYS-USE-CASE', {
      message: 'Case summary not found for case ID.',
    });
    jest.spyOn(StaffUseCase.prototype, 'getAttorneyList').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    jest.spyOn(StaffUseCase.prototype, 'getAttorneyList').mockRejectedValue(error);
    await expect(controller.handleRequest(context)).rejects.toThrow('Unknown Error');
  });
});
