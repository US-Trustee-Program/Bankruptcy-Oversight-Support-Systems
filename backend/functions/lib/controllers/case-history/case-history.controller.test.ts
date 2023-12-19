import { CaseHistoryController } from './case-history.controller';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NORMAL_CASE_ID } from '../../adapters/gateways/dxtr/case-docket.mock.gateway';
import {
  NOT_FOUND_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../cosmos-humble-objects/fake.cosmos-client-humble';

describe('Test case-history controller', () => {
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should return a case history when getCaseHistory is called', async () => {
    const caseId = NORMAL_CASE_ID;
    const controller = new CaseHistoryController(applicationContext);
    const result = await controller.getCaseHistory({ caseId });
    expect(result.success).toBeTruthy();
    expect(result.body).toEqual(CASE_HISTORY);
  });

  test('should throw a NotFoundError when a history is not found', async () => {
    const caseId = NOT_FOUND_ERROR_CASE_ID; // Induce a NotFoundError
    const controller = new CaseHistoryController(applicationContext);
    await expect(controller.getCaseHistory({ caseId })).rejects.toThrow('Not found');
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown error';
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID; // Induce a UnknownError
    const controller = new CaseHistoryController(applicationContext);
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getCaseHistory({ caseId })).rejects.toThrow(expectedMessage);
  });
});
