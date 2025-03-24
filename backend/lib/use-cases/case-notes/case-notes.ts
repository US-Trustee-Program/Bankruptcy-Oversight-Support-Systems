import { ApplicationContext } from '../../adapters/types/basic';
import { getCaseNotesRepository } from '../../factory';
import { CaseNotesRepository, UpdateResult } from '../gateways.types';
import {
  CaseNote,
  CaseNoteBackup,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
} from '../../../../common/src/cams/cases';
import { CamsUser } from '../../../../common/src/cams/users';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { randomUUID } from 'node:crypto';
import { PaginationParameters } from '../../../../common/src/api/pagination';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { Action, Actions, ResourceActions } from '../../../../common/src/cams/actions';

const MODULE_NAME = 'CASE-NOTES-USE-CASE';

export class CaseNotesUseCase {
  private caseNotesRepository: CaseNotesRepository;
  private context: ApplicationContext;
  constructor(applicationContext: ApplicationContext) {
    this.caseNotesRepository = getCaseNotesRepository(applicationContext);
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
    // TODO: after transform has been run, remove use of updated in lieu of missing created
    const existingNote = await this.caseNotesRepository.read(archiveRequest.id);
    const creator = existingNote.createdBy ?? existingNote.updatedBy;
    if (creator.id !== archiveRequest.sessionUser.id) {
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
    // TODO: after transform has been run, remove use of updated in lieu of missing created
    const { note, sessionUser } = noteEditRequest;
    const existingNote = await this.caseNotesRepository.read(note.id);
    const noteCreator = existingNote.createdBy ?? existingNote.updatedBy;
    if (noteCreator.id !== sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const dateOfEdit = new Date().toISOString();
    const newNote: CaseNote = {
      ...note,
      id: randomUUID(),
      documentType: 'NOTE',
      previousVersionId: note.id,
      updatedOn: dateOfEdit,
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
      createdBy: note.createdBy ?? note.updatedBy,
      createdOn: note.createdOn ?? note.updatedOn,
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

  //TODO: Remove when successfully run
  public async migrateLegacyCaseNotesPage(pagination: PaginationParameters) {
    const notesPage = await this.caseNotesRepository.getLegacyCaseNotesPage(pagination);
    for (const note of notesPage.data) {
      const noteBackup: CaseNoteBackup = {
        ...note,
        originalId: note.id,
        id: randomUUID(),
        documentType: 'NOTE_BACKUP',
      };
      this.caseNotesRepository.createCaseNoteBackup(noteBackup);
      this.context.logger.info(MODULE_NAME, `Created Backup for NoteId: ${note.id}`);
    }
    const legacyNotes = notesPage.data.reduce((acc, note) => {
      if (!note.createdOn) {
        acc.push({
          id: note.id,
          caseId: note.caseId,
          createdOn: note.updatedOn,
          createdBy: note.updatedBy,
        });
      }
      return acc;
    }, []);

    for (const note of legacyNotes) {
      this.context.logger.info(MODULE_NAME, `Inserted NoteId:  ${note.id}`);

      await this.caseNotesRepository.update(note);
    }
    return {
      metadata: { total: notesPage.metadata.total, ...pagination },
      data: legacyNotes,
    };
  }

  private getAction(note: ResourceActions<CaseNote>): Action[] | undefined {
    const userRef = getCamsUserReference(this.context.session.user);
    const creator = note.createdBy ?? note.updatedBy;
    if (creator.id === userRef.id) {
      return [Actions.merge(Actions.EditNote, note), Actions.merge(Actions.RemoveNote, note)];
    }
  }
}
