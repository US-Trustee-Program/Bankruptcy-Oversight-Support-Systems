import { NORMAL_CASE_ID } from '../../cosmos-humble-objects/fake.cosmos-client-humble';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseHistoryUseCase } from './case-history';

describe('Test case-history use case', () => {
  test('should return a case history when getCaseHistory is called', async () => {
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const caseId = NORMAL_CASE_ID;
    const useCase = new CaseHistoryUseCase(mockContext);
    const result = await useCase.getCaseHistory(caseId);
    expect(result).toEqual(CASE_HISTORY);
  });
});
