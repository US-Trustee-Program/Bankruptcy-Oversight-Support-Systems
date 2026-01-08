import { CaseAssociatedController } from './case-associated.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  NORMAL_CASE_ID,
  NOT_FOUND_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseAssociatedUseCase } from '../../use-cases/case-associated/case-associated';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Test case-history controller', () => {
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should return associated cases when handleRequest is called', async () => {
    const associatedCases = [
      MockData.getConsolidationReference({ override: { documentType: 'CONSOLIDATION_FROM' } }),
      MockData.getConsolidationReference(),
    ];
    vi.spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases').mockResolvedValue(
      associatedCases,
    );
    const caseId = NORMAL_CASE_ID;
    applicationContext.request.params.caseId = caseId;
    const controller = new CaseAssociatedController();
    const result = await controller.handleRequest(applicationContext);
    expect(result.body.data).toEqual(associatedCases);
  });

  test('should throw a NotFoundError when a history is not found', async () => {
    vi.spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases').mockRejectedValue(
      new NotFoundError('TEST'),
    );
    const caseId = NOT_FOUND_ERROR_CASE_ID;
    applicationContext.request.params.caseId = caseId;
    const controller = new CaseAssociatedController();
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow('Not found');
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown Error';
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID;
    applicationContext.request.params.caseId = caseId;
    const controller = new CaseAssociatedController();
    vi.spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedMessage);
  });
});
