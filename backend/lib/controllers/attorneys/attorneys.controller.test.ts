import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import AttorneysList from '../../use-cases/attorneys';
import { NotFoundError } from '../../common-errors/not-found-error';
import { AttorneysController } from './attorneys.controller';

describe('Attorneys Controller Tests', () => {
  let applicationContext;
  let controller;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    controller = new AttorneysController();
  });

  test('should return success if attorneys are found', async () => {
    const attorneyList = MockData.buildArray(MockData.getAttorneyUser, 5);

    jest.spyOn(AttorneysList.prototype, 'getAttorneyList').mockResolvedValue(attorneyList);
    const response = await controller.handleRequest(applicationContext);
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
    jest.spyOn(AttorneysList.prototype, 'getAttorneyList').mockRejectedValue(error);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(error);
  });

  test('should throw any other error', async () => {
    const error = new Error('TestError');
    jest.spyOn(AttorneysList.prototype, 'getAttorneyList').mockRejectedValue(error);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow('Unknown Error');
  });
});
