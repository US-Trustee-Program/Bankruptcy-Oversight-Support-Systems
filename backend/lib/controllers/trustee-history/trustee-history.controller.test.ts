import { TrusteeHistoryController } from './trustee-history.controller';
import { TrusteesUseCase } from '../../use-cases/trustees/trustees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import { ApplicationContext } from '../../adapters/types/basic';
import { TRUSTEE_HISTORY } from '../../testing/mock-data/trustee-history.mock';
import { NORMAL_TRUSTEE_ID } from '../../testing/testing-constants';

describe('Test trustee-history controller', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    applicationContext.request.params = { trusteeId: NORMAL_TRUSTEE_ID };
  });

  test('should return trustee history when handleRequest is called', async () => {
    jest.spyOn(TrusteesUseCase.prototype, 'listHistory').mockResolvedValue(TRUSTEE_HISTORY);
    const controller = new TrusteeHistoryController(applicationContext);
    const result = await controller.handleRequest(applicationContext);
    expect(result.body['data']).toEqual(TRUSTEE_HISTORY);
  });

  test('should throw a NotFoundError when history is not found', async () => {
    jest
      .spyOn(TrusteesUseCase.prototype, 'listHistory')
      .mockRejectedValue(new NotFoundError('TEST'));
    const controller = new TrusteeHistoryController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow('Not found');
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown Error';
    const controller = new TrusteeHistoryController(applicationContext);
    jest.spyOn(TrusteesUseCase.prototype, 'listHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedMessage);
  });
});
