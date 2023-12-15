import { NORMAL_CASE_ID } from '../../adapters/gateways/case.history.mock.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseHistoryController } from './case-history.controller';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';

describe('Test case-history controller', () => {
  test('should return a case history when getCaseHistory is called', async () => {
    const caseId = NORMAL_CASE_ID;
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseHistoryController(mockContext);
    const result = await controller.getCaseHistory(mockContext, { caseId });
    expect(result.success).toBeTruthy();
    expect(result.body).toEqual(CASE_HISTORY);
  });
  test('should throw a NotFoundError when a history is not found', async () => {
    const caseId = '000-00-00000'; // Induce a NotFoundError
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseHistoryController(mockContext);
    await expect(controller.getCaseHistory(mockContext, { caseId })).rejects.toThrow('Not found');
  });
  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown error';
    const caseId = '000-00-00000'; // Induce a UnknownError
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseHistoryController(mockContext);
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getCaseHistory(mockContext, { caseId })).rejects.toThrow(
      expectedMessage,
    );
  });
});
