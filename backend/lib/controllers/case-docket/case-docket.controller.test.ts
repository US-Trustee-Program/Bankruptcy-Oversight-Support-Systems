import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseDocketController } from './case-docket.controller';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import {
  NORMAL_CASE_ID,
  NOT_FOUND_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';

describe('Test case-docket controller', () => {
  test('should return a case docket when getCaseDocket is called', async () => {
    const caseId = NORMAL_CASE_ID;
    const mockContext = await createMockApplicationContext({ request: { params: { caseId } } });
    const controller = new CaseDocketController(mockContext);
    const result = await controller.handleRequest(mockContext);
    expect(result.body.data).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });

  test('should throw a NotFoundError when a docket is not found', async () => {
    const caseId = NOT_FOUND_ERROR_CASE_ID;
    const mockContext = await createMockApplicationContext({ request: { params: { caseId } } });
    const controller = new CaseDocketController(mockContext);
    await expect(controller.handleRequest(mockContext)).rejects.toThrow('Not found');
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown Error';
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID;
    const mockContext = await createMockApplicationContext({ request: { params: { caseId } } });
    const controller = new CaseDocketController(mockContext);
    vi.spyOn(CaseDocketUseCase.prototype, 'getCaseDocket').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.handleRequest(mockContext)).rejects.toThrow(expectedMessage);
  });
});
