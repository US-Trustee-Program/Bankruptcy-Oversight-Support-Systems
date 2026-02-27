import { vi } from 'vitest';
import { randomUUID } from 'crypto';
import { TrusteeNote, TrusteeNoteEditRequest, TrusteeNoteInput } from '@common/cams/trustee-notes';
import MockData from '@common/cams/test-utilities/mock-data';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { TrusteeNotesUseCase } from './trustee-notes';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { CamsRole } from '@common/cams/roles';
import { ResourceActions } from '@common/cams/actions';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

describe('Test trustee-notes use case', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return a list of trustee notes when getTrusteeNotes is called', async () => {
    const userRef = MockData.getCamsUserReference();
    const userNotes = [
      MockData.getTrusteeNote({ createdBy: userRef }),
      MockData.getTrusteeNote({ createdBy: userRef }),
    ];
    const otherNotes = MockData.buildArray(MockData.getTrusteeNote, 3);
    const existingNotesArray = [...userNotes, ...otherNotes];
    vi.spyOn(MockMongoRepository.prototype, 'getNotesByTrusteeId').mockResolvedValue(
      existingNotesArray,
    );
    const expected: ResourceActions<TrusteeNote>[] = [...otherNotes];
    for (const userNote of userNotes) {
      expected.push({
        ...userNote,
        _actions: expect.arrayContaining([
          expect.objectContaining({
            actionName: 'edit trustee note',
            method: 'PUT',
            path: `/trustees/${userNote.trusteeId}/notes/${userNote.id}`,
          }),
          expect.objectContaining({
            actionName: 'remove trustee note',
            method: 'DELETE',
            path: `/trustees/${userNote.trusteeId}/notes/${userNote.id}`,
          }),
        ]),
      });
    }

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new TrusteeNotesUseCase(context);
    const trusteeId = userNotes[0].trusteeId;
    const result = await useCase.getTrusteeNotes(trusteeId);

    expect(result).toEqual(expect.arrayContaining(expected));
  });

  test('should handle error when getNotesByTrusteeId throws an error', async () => {
    const userRef = MockData.getCamsUserReference();
    const error = new Error('Test Error');
    vi.spyOn(MockMongoRepository.prototype, 'getNotesByTrusteeId').mockRejectedValue(error);
    const MODULE_NAME = 'TRUSTEE-NOTES-USE-CASE';
    const trusteeId = randomUUID();
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new TrusteeNotesUseCase(context);
    const expectedError = getCamsErrorWithStack(error, MODULE_NAME, {
      camsStackInfo: {
        module: MODULE_NAME,
        message: `Failed to get notes for trustee: ${trusteeId}.`,
      },
    });
    await expect(useCase.getTrusteeNotes(trusteeId)).rejects.toThrow(expectedError);
  });

  test('should create a trustee note when createTrusteeNote is called', async () => {
    const trusteeId = randomUUID();
    const noteContent = 'Some content relevant to the trustee.';
    const noteTitle = 'Some Trustee Note Title.';
    const user = MockData.getCamsUserReference();

    const context = await createMockApplicationContext();
    const useCase = new TrusteeNotesUseCase(context);
    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const expectedNote: TrusteeNote = {
      title: noteTitle,
      documentType: 'TRUSTEE_NOTE',
      trusteeId,
      createdBy: user,
      createdOn: expect.anything(),
      updatedBy: user,
      updatedOn: expect.anything(),
      content: noteContent,
    };
    const noteInput: TrusteeNoteInput = {
      trusteeId,
      title: noteTitle,
      content: noteContent,
    };
    await useCase.createTrusteeNote(user, noteInput);

    expect(createSpy).toHaveBeenCalledWith(expectedNote);
  });

  test('should archive a trustee note when archiveTrusteeNote is called', async () => {
    const userRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrusteeAdmin],
    };

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });
    const existingNote = MockData.getTrusteeNote({ updatedBy: user, createdBy: user });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);
    const useCase = new TrusteeNotesUseCase(context);
    const archiveSpy = vi
      .spyOn(MockMongoRepository.prototype, 'archiveTrusteeNote')
      .mockImplementation(async () => {});

    const archiveNoteRequest = MockData.getTrusteeNoteDeletionRequest({
      id: randomUUID(),
      sessionUser: userRef,
    });
    const expectedArchiveNote: Partial<TrusteeNote> = {
      id: archiveNoteRequest.id,
      trusteeId: archiveNoteRequest.trusteeId,
      archivedOn: expect.anything(),
      archivedBy: userRef,
    };

    await useCase.archiveTrusteeNote(archiveNoteRequest);

    expect(archiveSpy).toHaveBeenCalledWith(expectedArchiveNote);
  });

  test('when editTrusteeNote is called, create should be called with new note containing previousVersionId, archiving old note', async () => {
    const userRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrusteeAdmin],
    };

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new TrusteeNotesUseCase(context);

    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const archiveSpy = vi
      .spyOn(MockMongoRepository.prototype, 'archiveTrusteeNote')
      .mockImplementation(async () => {});

    const existingNote: TrusteeNote = MockData.getTrusteeNote({ updatedBy: user, createdBy: user });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);
    const newNote: TrusteeNote = MockData.getTrusteeNote({
      ...existingNote,
      content: 'Edited Note Content',
      title: 'Edited Note Title',
      previousVersionId: existingNote.id,
      updatedBy: userRef,
    });

    const expectedArchiveNote: Partial<TrusteeNote> = {
      id: existingNote.id,
      trusteeId: existingNote.trusteeId,
      archivedOn: expect.anything(),
      archivedBy: userRef,
    };

    const request: TrusteeNoteEditRequest = {
      note: newNote,
      sessionUser: user,
    };
    await useCase.editTrusteeNote(request);

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

  test('should throw error when user is not the creator when attempting to archive', async () => {
    const userRef = MockData.getCamsUserReference();
    const wrongUserRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrusteeAdmin],
    };
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });
    const existingNote = MockData.getTrusteeNote({ updatedBy: wrongUserRef });
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);

    const useCase = new TrusteeNotesUseCase(context);

    const archiveNoteRequest = MockData.getTrusteeNoteDeletionRequest({
      id: randomUUID(),
      sessionUser: userRef,
    });

    await expect(useCase.archiveTrusteeNote(archiveNoteRequest)).rejects.toThrow(
      'User is not the creator of the note.',
    );
  });

  test('should throw error when user is not the creator when attempting to edit', async () => {
    const userRef = MockData.getCamsUserReference();
    const wrongUserRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrusteeAdmin],
    };
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new TrusteeNotesUseCase(context);
    const existingNote = MockData.getTrusteeNote({ updatedBy: wrongUserRef });
    const readSpy = vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingNote);

    const editNoteRequest = MockData.getTrusteeNoteEditRequest({
      note: existingNote,
      sessionUser: userRef,
    });

    await expect(useCase.editTrusteeNote(editNoteRequest)).rejects.toThrow(
      'User is not the creator of the note.',
    );
    expect(readSpy).toHaveBeenCalledWith(existingNote.id);
  });

  test('should propagate error when read throws during archiveTrusteeNote', async () => {
    const userRef = MockData.getCamsUserReference();
    const readError = new Error('Database read failed');
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(readError);

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new TrusteeNotesUseCase(context);

    const archiveRequest = MockData.getTrusteeNoteDeletionRequest({
      id: randomUUID(),
      sessionUser: userRef,
    });

    await expect(useCase.archiveTrusteeNote(archiveRequest)).rejects.toThrow(
      'Database read failed',
    );
  });

  test('should propagate error when read throws during editTrusteeNote', async () => {
    const userRef = MockData.getCamsUserReference();
    const readError = new Error('Database read failed');
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(readError);

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: userRef });
    const useCase = new TrusteeNotesUseCase(context);

    const existingNote = MockData.getTrusteeNote({ createdBy: userRef });
    const editRequest = MockData.getTrusteeNoteEditRequest({
      note: existingNote,
      sessionUser: userRef,
    });

    await expect(useCase.editTrusteeNote(editRequest)).rejects.toThrow('Database read failed');
  });
});
