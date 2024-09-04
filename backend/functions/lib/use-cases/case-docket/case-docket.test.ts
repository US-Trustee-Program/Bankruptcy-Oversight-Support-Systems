import { MockCaseDocketGateway } from '../../adapters/gateways/dxtr/case-docket.mock.gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketUseCase } from './case-docket';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';

describe('Test case-docket use case', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const gateway = new MockCaseDocketGateway();
    const caseId = NORMAL_CASE_ID;
    const useCase = new CaseDocketUseCase(gateway);
    const mockContext = await createMockApplicationContext();
    const result = await useCase.getCaseDocket(mockContext, caseId);
    expect(result).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });
});
