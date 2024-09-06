import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import AttorneysController from './attorneys.controller';
import { commonHeaders } from '../../adapters/utils/http-response';
import AttorneysList from '../../use-cases/attorneys';

describe('Attorneys Controller Tests', () => {
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should get list of attorneys', async () => {
    const attorneysList = MockData.buildArray(MockData.getAttorneyUser, 5);
    jest.spyOn(AttorneysList.prototype, 'getAttorneyList').mockResolvedValue(attorneysList);
    const response = await AttorneysController.getAttorneyList(applicationContext);
    expect(response).toEqual({
      body: { data: attorneysList },
      statusCode: 200,
      headers: commonHeaders,
    });
  });

  test('should throw error', async () => {
    const error = new Error();
    jest.spyOn(AttorneysList.prototype, 'getAttorneyList').mockRejectedValue(error);
    await expect(AttorneysController.getAttorneyList(applicationContext)).rejects.toThrow(error);
  });
});
