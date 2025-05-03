import { randomUUID } from 'node:crypto';

import { Action, Actions, ResourceActions } from '../../../../common/src/cams/actions';
import {
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
} from '../../../../common/src/cams/cases';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { CamsUser } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getCaseNotesRepository } from '../../factory';
import { CaseNotesRepository, UpdateResult } from '../gateways.types';

const MODULE_NAME = 'CASE-NOTES-USE-CASE';

export class CaseNotesUseCase {
  private caseNotesRepository: CaseNotesRepository;
  private context: ApplicationContext;
  constructor(applicationContext: ApplicationContext) {
    this.caseNotesRepository = getCaseNotesRepository(applicationContext);
    this.context = applicationContext;
  }

  public async archiveCaseNote(archiveRequest: CaseNoteDeleteRequest): Promise<UpdateResult> {
    const { caseId, id, sessionUser } = archiveRequest;
    const existingNote = await this.caseNotesRepository.read(archiveRequest.id);
    if (existingNote.createdBy.id !== archiveRequest.sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const newArchiveNote: Partial<CaseNote> = {
      archivedBy: getCamsUserReference(sessionUser),
      archivedOn: new Date().toISOString(),
      caseId,
      id,
    };
    return await this.caseNotesRepository.archiveCaseNote(newArchiveNote);
  }

  public async createCaseNote(user: CamsUser, noteInput: CaseNoteInput): Promise<void> {
    const userRef = getCamsUserReference(user);
    const today = new Date().toISOString();
    const data: CaseNote = {
      ...noteInput,
      createdBy: userRef,
      createdOn: today,
      documentType: 'NOTE',
      updatedBy: userRef,
      updatedOn: today,
    };

    await this.caseNotesRepository.create(data);
  }

  public async editCaseNote(noteEditRequest: CaseNoteEditRequest): Promise<CaseNote> {
    const { note, sessionUser } = noteEditRequest;
    const existingNote = await this.caseNotesRepository.read(note.id);
    if (existingNote.createdBy.id !== sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const dateOfEdit = new Date().toISOString();
    const newNote: CaseNote = {
      ...existingNote,
      ...note,
      documentType: 'NOTE',
      id: randomUUID(),
      previousVersionId: note.id,
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
      updatedOn: dateOfEdit,
    };

    const archiveNote: Partial<CaseNote> = {
      archivedBy: getCamsUserReference(sessionUser),
      archivedOn: dateOfEdit,
      caseId: note.caseId,
      id: note.id,
    };

    const creationResponse = await this.caseNotesRepository.create(newNote);
    await this.caseNotesRepository.archiveCaseNote(archiveNote);
    return creationResponse;
  }

  public async getCaseNotes(caseId: string): Promise<ResourceActions<CaseNote>[]> {
    try {
      const notes: ResourceActions<CaseNote>[] =
        await this.caseNotesRepository.getNotesByCaseId(caseId);
      for (const note of notes) {
        note._actions = this.getAction(note) ?? undefined;
      }
      return notes;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to get notes for case: ${caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  private getAction(note: ResourceActions<CaseNote>): Action[] | undefined {
    const userRef = getCamsUserReference(this.context.session.user);
    if (note.createdBy.id === userRef.id) {
      return [Actions.merge(Actions.EditNote, note), Actions.merge(Actions.RemoveNote, note)];
    }
  }
}
