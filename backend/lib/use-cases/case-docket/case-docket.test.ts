import { MockCaseDocketGateway } from '../../adapters/gateways/dxtr/case-docket.mock.gateway';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketUseCase } from './case-docket';

describe('Test case-docket use case', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const gateway = new MockCaseDocketGateway();
    const caseId = NORMAL_CASE_ID;
    const useCase = new CaseDocketUseCase(gateway);
    const mockContext = await createMockApplicationContext();
    mockContext.request.params.caseId = caseId;
    const result = await useCase.getCaseDocket(mockContext);
    expect(result).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });
});
