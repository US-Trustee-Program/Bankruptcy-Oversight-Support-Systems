import {
  MockCaseHistoryCosmosDbRepository,
  NORMAL_CASE_ID,
} from '../../adapters/gateways/case.history.mock.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseHistoryUseCase } from './case-history';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';

describe('Test case-history use case', () => {
  test('should return a case history when getCaseHistory is called', async () => {
    const gateway = new MockCaseHistoryCosmosDbRepository();
    const caseId = NORMAL_CASE_ID;
    const useCase = new CaseHistoryUseCase(gateway);
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const result = await useCase.getCaseHistory(mockContext, caseId);
    expect(result).toEqual(CASE_HISTORY);
  });
});
