import { CaseAssociatedController } from './case-associated.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  NORMAL_CASE_ID,
  NOT_FOUND_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseAssociatedUseCase } from '../../use-cases/case-associated/case-associated';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';

describe('Test case-history controller', () => {
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should return associated cases when getAssociatedCases is called', async () => {
    const associatedCases = [
      MockData.getConsolidationReference({ override: { documentType: 'CONSOLIDATION_FROM' } }),
      MockData.getConsolidationReference(),
    ];
    jest
      .spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases')
      .mockResolvedValue(associatedCases);
    const caseId = NORMAL_CASE_ID;
    const controller = new CaseAssociatedController(applicationContext);
    const result = await controller.getAssociatedCases(applicationContext, { caseId });
    expect(result.success).toBeTruthy();
    expect(result['body']).toEqual(associatedCases);
  });

  test('should throw a NotFoundError when a history is not found', async () => {
    jest
      .spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases')
      .mockRejectedValue(new NotFoundError('TEST'));
    const caseId = NOT_FOUND_ERROR_CASE_ID;
    const controller = new CaseAssociatedController(applicationContext);
    await expect(controller.getAssociatedCases(applicationContext, { caseId })).rejects.toThrow(
      'Not found',
    );
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const expectedMessage = 'Unknown error';
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID;
    const controller = new CaseAssociatedController(applicationContext);
    jest
      .spyOn(CaseAssociatedUseCase.prototype, 'getAssociatedCases')
      .mockImplementation(async () => {
        throw Error(expectedMessage);
      });
    await expect(controller.getAssociatedCases(applicationContext, { caseId })).rejects.toThrow(
      expectedMessage,
    );
  });
});
