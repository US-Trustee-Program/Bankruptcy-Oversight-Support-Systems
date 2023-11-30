import { NORMAL_CASE_ID } from '../../adapters/gateways/dxtr/case-docket.mock.gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketController } from './case-docket.controller';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';

describe('Test case-docket controller', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const caseId = NORMAL_CASE_ID;
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseDocketController(mockContext);
    const result = await controller.getCaseDocket(mockContext, { caseId });
    expect(result.success).toBeTruthy();
    expect(result.body).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });
  test('should throw a NotFoundError when a docket is not found', async () => {
    const caseId = '000-00-00000'; // Induce a NotFoundError
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseDocketController(mockContext);
    await expect(controller.getCaseDocket(mockContext, { caseId })).rejects.toThrow('Not found');
  });
  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown error';
    const caseId = '000-00-00000'; // Induce a UnknownError
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const controller = new CaseDocketController(mockContext);
    jest.spyOn(CaseDocketUseCase.prototype, 'getCaseDocket').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getCaseDocket(mockContext, { caseId })).rejects.toThrow(
      expectedMessage,
    );
  });
});
