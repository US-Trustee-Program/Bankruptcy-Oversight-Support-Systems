import { CasesCosmosMongoDbRepository } from '../../adapters/gateways/cases.cosmosdb.mongo.repository';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseHistoryUseCase } from './case-history';

describe('Test case-history use case', () => {
  test('should return a case history when getCaseHistory is called', async () => {
    jest
      .spyOn(CasesCosmosMongoDbRepository.prototype, 'getCaseHistory')
      .mockResolvedValue(CASE_HISTORY);
    const mockContext = await createMockApplicationContext();
    const caseId = NORMAL_CASE_ID;
    const useCase = new CaseHistoryUseCase(mockContext);
    const result = await useCase.getCaseHistory(mockContext, caseId);
    expect(result).toEqual(CASE_HISTORY);
  });
});
