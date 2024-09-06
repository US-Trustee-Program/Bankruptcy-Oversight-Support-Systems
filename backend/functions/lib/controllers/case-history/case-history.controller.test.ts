import { CaseHistoryController } from './case-history.controller';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';

describe('Test case-history controller', () => {
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should return a case history when getCaseHistory is called', async () => {
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockResolvedValue(CASE_HISTORY);
    const controller = new CaseHistoryController(applicationContext);
    const result = await controller.getCaseHistory(applicationContext);
    expect(result.body['data']).toEqual(CASE_HISTORY);
  });

  test('should throw a NotFoundError when a history is not found', async () => {
    jest
      .spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory')
      .mockRejectedValue(new NotFoundError('TEST'));
    const controller = new CaseHistoryController(applicationContext);
    await expect(controller.getCaseHistory(applicationContext)).rejects.toThrow('Not found');
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown error';
    const controller = new CaseHistoryController(applicationContext);
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getCaseHistory(applicationContext)).rejects.toThrow(expectedMessage);
  });
});
