import { vi } from 'vitest';
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
import { ResourceActions } from '../../../../common/src/cams/actions';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

describe('Test case-notes use case', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return a list of case notes when getCaseNotes is called', async () => {
    const userRef = MockData.getCamsUserReference();
    const userNotes = [
      MockData.getCaseNote({ createdBy: userRef }),
      MockData.getCaseNote({ createdBy: userRef }),
    ];
    const otherNotes = MockData.buildArray(MockData.getCaseNote, 3);
    const existingCaseNotesArray = [...userNotes, ...otherNotes];
    vi.spyOn(MockMongoRepository.prototype, 'getNotesByCaseId').mockResolvedValue(
      existingCaseNotesArray,
    );
    const expected: ResourceActions<CaseNote>[] = [...otherNotes];
    for (const userNote of userNotes) {
      expected.push({
        ...userNote,
        _actions: expect.arrayContaining([
          expect.objectContaining({
            actionName: 'edit note',
            method: 'PUT',
            path: `/cases/${userNote.caseId}/notes/${userNote.id}`,
          }),
          expect.objectContaining({
            actionName: 'remove note',
            method: 'DELETE',
            path: `/cases/${userNote.caseId}/notes/${userNote.id}`,
          }),
        ]),
      });
    }

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new CaseNotesUseCase(context);
    const caseNotesResult = await useCase.getCaseNotes(NORMAL_CASE_ID);

    expect(caseNotesResult).toEqual(expect.arrayContaining(expected));
  });

  test('should handle error when getCaseNotesByCaseId throws an error', async () => {
    const userRef = MockData.getCamsUserReference();
    const error = new Error('Test Error');
    vi.spyOn(MockMongoRepository.prototype, 'getNotesByCaseId').mockRejectedValue(error);
    const MODULE_NAME = 'CASE-NOTES-USE-CASE';
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new CaseNotesUseCase(context);
    const expectedError = getCamsErrorWithStack(error, MODULE_NAME, {
      camsStackInfo: {
        module: MODULE_NAME,
        message: `Failed to get notes for case: ${NORMAL_CASE_ID}.`,
      },
    });
    await expect(useCase.getCaseNotes(NORMAL_CASE_ID)).rejects.toThrow(expectedError);
  });

  test('should create a case note when createCaseNote is called', async () => {
    const mockCase = MockData.getCaseBasics();
    const caseNoteContent = 'Some content relevant to the case.';
    const caseNoteTitle = 'Some Case Note Title.';
    const user = MockData.getCamsUserReference();

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const expectedNote: CaseNote = {
      title: caseNoteTitle,
      documentType: 'NOTE',
      caseId: mockCase.caseId,
      createdBy: user,
      createdOn: expect.anything(),
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
    const existingNote = MockData.getCaseNote({ updatedBy: user, createdBy: user });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);
    const useCase = new CaseNotesUseCase(context);
    const archiveSpy = vi
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const archiveNoteRequest = MockData.getCaseNoteDeletionRequest({
      id: randomUUID(),
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

    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const archiveSpy = vi
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const existingNote: CaseNote = MockData.getCaseNote({ updatedBy: user, createdBy: user });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);
    const newNote: CaseNote = MockData.getCaseNote({
      ...existingNote,
      content: 'Edited Note Content',
      title: 'Edited Note Title',
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
      note: newNote,
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
    const existingNote = MockData.getCaseNote({ updatedBy: wrongUserRef });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);

    const useCase = new CaseNotesUseCase(context);

    const archiveNoteRequest = MockData.getCaseNoteDeletionRequest({
      id: randomUUID(),
      sessionUser: userRef,
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
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new CaseNotesUseCase(context);
    const existingNote = MockData.getCaseNote({ updatedBy: wrongUserRef });
    const readSpy = vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);

    const editNoteRequest = MockData.getCaseNoteEditRequest({
      note: existingNote,
      sessionUser: userRef,
    });

    await expect(useCase.editCaseNote(editNoteRequest)).rejects.toThrow(
      'User is not the creator of the note.',
    );
    expect(readSpy).toHaveBeenCalledWith(existingNote.id);
  });
});
