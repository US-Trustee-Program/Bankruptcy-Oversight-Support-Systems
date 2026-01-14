import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CaseNotesRepository, UpdateResult } from '../gateways.types';
import {
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
} from '@common/cams/cases';
import { CamsUser } from '@common/cams/users';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getCamsUserReference } from '@common/cams/session';
import { randomUUID } from 'node:crypto';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import Actions, { Action, ResourceActions } from '@common/cams/actions';

const MODULE_NAME = 'CASE-NOTES-USE-CASE';

export class CaseNotesUseCase {
  private caseNotesRepository: CaseNotesRepository;
  private context: ApplicationContext;
  constructor(applicationContext: ApplicationContext) {
    this.caseNotesRepository = factory.getCaseNotesRepository(applicationContext);
    this.context = applicationContext;
  }

  public async createCaseNote(user: CamsUser, noteInput: CaseNoteInput): Promise<void> {
    const userRef = getCamsUserReference(user);
    const today = new Date().toISOString();
    const data: CaseNote = {
      ...noteInput,
      documentType: 'NOTE',
      updatedBy: userRef,
      updatedOn: today,
      createdBy: userRef,
      createdOn: today,
    };

    await this.caseNotesRepository.create(data);
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
          module: MODULE_NAME,
          message: `Failed to get notes for case: ${caseId}.`,
        },
      });
    }
  }

  public async archiveCaseNote(archiveRequest: CaseNoteDeleteRequest): Promise<UpdateResult> {
    const { caseId, id, sessionUser } = archiveRequest;
    const existingNote = await this.caseNotesRepository.read(archiveRequest.id);
    if (existingNote.createdBy.id !== archiveRequest.sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const newArchiveNote: Partial<CaseNote> = {
      caseId,
      id,
      archivedOn: new Date().toISOString(),
      archivedBy: getCamsUserReference(sessionUser),
    };
    return await this.caseNotesRepository.archiveCaseNote(newArchiveNote);
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
      id: randomUUID(),
      documentType: 'NOTE',
      previousVersionId: note.id,
      updatedOn: dateOfEdit,
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
    };

    const archiveNote: Partial<CaseNote> = {
      id: note.id,
      caseId: note.caseId,
      archivedOn: dateOfEdit,
      archivedBy: getCamsUserReference(sessionUser),
    };

    const creationResponse = await this.caseNotesRepository.create(newNote);
    await this.caseNotesRepository.archiveCaseNote(archiveNote);
    return creationResponse;
  }

  private getAction(note: ResourceActions<CaseNote>): Action[] | undefined {
    const userRef = getCamsUserReference(this.context.session.user);
    if (note.createdBy.id === userRef.id) {
      return [Actions.merge(Actions.EditNote, note), Actions.merge(Actions.RemoveNote, note)];
    }
  }
}
