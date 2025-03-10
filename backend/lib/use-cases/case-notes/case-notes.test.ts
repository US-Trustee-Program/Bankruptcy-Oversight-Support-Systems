import { randomUUID } from 'crypto';
import { CaseNote, CaseNoteArchival, CaseNoteInput } from '../../../../common/src/cams/cases';
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
    const caseNoteTitle = 'Some Case Note Title.';
    const user = MockData.getCamsUserReference();

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const expectedNote: CaseNote = {
      title: caseNoteTitle,
      documentType: 'NOTE',
      caseId: mockCase.caseId,
      updatedBy: user,
      updatedOn: expect.anything(),
      content: caseNoteContent,
    };
    const caseNoteInput: CaseNoteInput = {
      caseId: mockCase.caseId,
      title: caseNoteTitle,
      content: caseNoteContent,
    };
    await useCase.createCaseNote(user, caseNoteInput);

    expect(createSpy).toHaveBeenCalledWith(expectedNote);
  });

  test('should update a case Note and call archive with correct parameters when archiveCaseNote is called', async () => {
    //TODO: how do we want to handle user validation?

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const updateOneSpy = jest
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const archiveNote = MockData.getCaseNoteArchival({ id: randomUUID() });

    const expectedArchiveNote: CaseNoteArchival = {
      ...archiveNote,
      archiveDate: expect.anything(),
    };
    await useCase.archiveCaseNote(archiveNote);

    expect(updateOneSpy).toHaveBeenCalledWith(expectedArchiveNote);
  });
});
