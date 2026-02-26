import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeNotesRepository, UpdateResult } from '../gateways.types';
import {
  TrusteeNote,
  TrusteeNoteDeleteRequest,
  TrusteeNoteEditRequest,
  TrusteeNoteInput,
} from '@common/cams/trustee-notes';
import { CamsUser } from '@common/cams/users';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getCamsUserReference } from '@common/cams/session';
import { randomUUID } from 'node:crypto';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import Actions, { Action, ResourceActions } from '@common/cams/actions';

const MODULE_NAME = 'TRUSTEE-NOTES-USE-CASE';

export class TrusteeNotesUseCase {
  private trusteeNotesRepository: TrusteeNotesRepository;
  private context: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.trusteeNotesRepository = factory.getTrusteeNotesRepository(applicationContext);
    this.context = applicationContext;
  }

  public async createTrusteeNote(user: CamsUser, noteInput: TrusteeNoteInput): Promise<void> {
    const userRef = getCamsUserReference(user);
    const today = new Date().toISOString();
    const data: TrusteeNote = {
      ...noteInput,
      documentType: 'TRUSTEE_NOTE',
      updatedBy: userRef,
      updatedOn: today,
      createdBy: userRef,
      createdOn: today,
    };

    await this.trusteeNotesRepository.create(data);
  }

  public async getTrusteeNotes(trusteeId: string): Promise<ResourceActions<TrusteeNote>[]> {
    try {
      const notes: ResourceActions<TrusteeNote>[] =
        await this.trusteeNotesRepository.getNotesByTrusteeId(trusteeId);
      for (const note of notes) {
        note._actions = this.getAction(note) ?? undefined;
      }
      return notes;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to get notes for trustee: ${trusteeId}.`,
        },
      });
    }
  }

  public async archiveTrusteeNote(archiveRequest: TrusteeNoteDeleteRequest): Promise<UpdateResult> {
    const { trusteeId, id, sessionUser } = archiveRequest;
    const existingNote = await this.trusteeNotesRepository.read(archiveRequest.id);
    if (existingNote.createdBy.id !== archiveRequest.sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const newArchiveNote: Partial<TrusteeNote> = {
      trusteeId,
      id,
      archivedOn: new Date().toISOString(),
      archivedBy: getCamsUserReference(sessionUser),
    };
    return await this.trusteeNotesRepository.archiveTrusteeNote(newArchiveNote);
  }

  public async editTrusteeNote(noteEditRequest: TrusteeNoteEditRequest): Promise<TrusteeNote> {
    const { note, sessionUser } = noteEditRequest;
    const existingNote = await this.trusteeNotesRepository.read(note.id);
    if (existingNote.createdBy.id !== sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const dateOfEdit = new Date().toISOString();
    const newNote: TrusteeNote = {
      ...existingNote,
      ...note,
      id: randomUUID(),
      documentType: 'TRUSTEE_NOTE',
      previousVersionId: note.id,
      updatedOn: dateOfEdit,
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
    };

    const archiveNote: Partial<TrusteeNote> = {
      id: note.id,
      trusteeId: note.trusteeId,
      archivedOn: dateOfEdit,
      archivedBy: getCamsUserReference(sessionUser),
    };

    const creationResponse = await this.trusteeNotesRepository.create(newNote);
    await this.trusteeNotesRepository.archiveTrusteeNote(archiveNote);
    return creationResponse;
  }

  private getAction(note: ResourceActions<TrusteeNote>): Action[] | undefined {
    const userRef = getCamsUserReference(this.context.session.user);
    if (note.createdBy.id === userRef.id) {
      return [
        Actions.merge(Actions.EditTrusteeNote, note),
        Actions.merge(Actions.RemoveTrusteeNote, note),
      ];
    }
  }
}
