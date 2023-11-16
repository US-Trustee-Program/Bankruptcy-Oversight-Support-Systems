import { DOCKET } from '../../adapters/gateways/mock/case-docket.mock.gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketController } from './case-docket.controller';

describe('Test case-docket controller', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const caseId = '111-11-1111';
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseDocketController(mockContext);
    const result = await controller.getCaseDocket(mockContext, { caseId });
    expect(result.success).toBeTruthy();
    expect(result.body).toEqual(DOCKET);
  });
});
