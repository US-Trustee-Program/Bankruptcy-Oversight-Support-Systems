import {
  DOCKET,
  MockCaseDocketGateway,
} from '../../adapters/gateways/mock/case-docket.mock.gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketUseCase } from './case-docket';

describe('Test case-docket use case', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const gateway = new MockCaseDocketGateway();
    const caseId = '111-11-1111';
    const useCase = new CaseDocketUseCase(gateway);
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const result = await useCase.getCaseDocket(mockContext, caseId);
    expect(result).toEqual(DOCKET);
  });
});
