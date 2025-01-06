import { CaseNote } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseNotesUseCase } from './case-notes';

describe('Test case-notes use case', () => {
  test('should return a list of case notes when getCaseNotes is called', async () => {
    const expectedCaseNotesArray = MockData.buildArray(MockData.getCaseNote, 3);
    jest
      .spyOn(MockMongoRepository.prototype, 'getNotesByCaseId')
      .mockResolvedValue(expectedCaseNotesArray);

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const caseNotesResult = await useCase.getCaseNotes(NORMAL_CASE_ID);

    expect(expectedCaseNotesArray).toEqual(caseNotesResult);
  });

  test('should create a case note when createCaseNote is called', async () => {
    const mockCase = MockData.getCaseBasics();
    const caseNoteContent = 'Some content relevant to the case.';
    const user = MockData.getCamsUserReference();

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const expectedNote: CaseNote = {
      documentType: 'NOTE',
      caseId: mockCase.caseId,
      updatedBy: user,
      updatedOn: expect.anything(),
      content: caseNoteContent,
    };

    await useCase.createCaseNote(user, mockCase.caseId, caseNoteContent);
    expect(createSpy).toHaveBeenCalledWith(expectedNote);
  });
});
