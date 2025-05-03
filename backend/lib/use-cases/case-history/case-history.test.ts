import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseHistoryUseCase } from './case-history';

describe('Test case-history use case', () => {
  test('should return a case history when getCaseHistory is called', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'getCaseHistory').mockResolvedValue(CASE_HISTORY);
    const mockContext = await createMockApplicationContext();
    const caseId = NORMAL_CASE_ID;
    mockContext.request.params.id = caseId;
    const useCase = new CaseHistoryUseCase();
    const result = await useCase.getCaseHistory(mockContext);
    expect(result).toEqual(CASE_HISTORY);
  });
});
