import { randomUUID } from 'crypto';
import { CaseNote, CaseNoteEditRequest, CaseNoteInput } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CaseNotesUseCase } from './case-notes';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { CamsRole } from '../../../../common/src/cams/roles';

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
    const userRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new CaseNotesUseCase(context);
    const archiveSpy = jest
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const archiveNoteRequest = MockData.getCaseNoteDeletionRequest({
      id: randomUUID(),
      userId: user.id,
      sessionUser: userRef,
    });
    const expectedArchiveNote: Partial<CaseNote> = {
      id: archiveNoteRequest.id,
      caseId: archiveNoteRequest.caseId,
      archivedOn: expect.anything(),
      archivedBy: userRef,
    };

    await useCase.archiveCaseNote(archiveNoteRequest);

    expect(archiveSpy).toHaveBeenCalledWith(expectedArchiveNote);
  });

  test('when editCaseNote is called, createOne should be called with the new note, containing the previous version Id, archiving the old note', async () => {
    const userRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new CaseNotesUseCase(context);

    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const archiveSpy = jest
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const existingNote: CaseNote = MockData.getCaseNote({ updatedBy: user });
    const newNote: CaseNote = MockData.getCaseNote({
      ...existingNote,
      previousVersionId: existingNote.id,
      updatedBy: userRef,
    });

    const expectedArchiveNote: Partial<CaseNote> = {
      id: existingNote.id,
      caseId: existingNote.caseId,
      archivedOn: expect.anything(),
      archivedBy: userRef,
    };

    const request: CaseNoteEditRequest = {
      note: existingNote,
      sessionUser: user,
    };
    await useCase.editCaseNote(request);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ...newNote,
        id: expect.anything(),
        updatedOn: expect.anything(),
      }),
    );
    expect(archiveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ...expectedArchiveNote,
        archivedOn: expect.anything(),
      }),
    );
  });

  test('should throw error when user is not user on the note when attempting to archive', async () => {
    const userRef = MockData.getCamsUserReference();
    const wrongUserRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: user });

    const useCase = new CaseNotesUseCase(context);

    const archiveNoteRequest = MockData.getCaseNoteDeletionRequest({
      id: randomUUID(),
      userId: user.id,
      sessionUser: wrongUserRef,
    });

    await expect(useCase.archiveCaseNote(archiveNoteRequest)).rejects.toThrow(
      'User is not the creator of the note.',
    );
  });

  test('should throw error when user is not user on the note when attempting to edit', async () => {
    const userRef = MockData.getCamsUserReference();
    const wrongUserRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: user });

    const useCase = new CaseNotesUseCase(context);
    const existingNote = MockData.getCaseNote();

    const editNoteRequest = MockData.getCaseNoteEditRequest({
      note: existingNote,
      sessionUser: wrongUserRef,
    });

    await expect(useCase.editCaseNote(editNoteRequest)).rejects.toThrow(
      'User is not the creator of the note.',
    );
  });
});
