import { ApplicationContext } from '../../adapters/types/basic';
import { getCaseNotesRepository } from '../../factory';
import { CaseNotesRepository, UpdateResult } from '../gateways.types';
import {
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
} from '../../../../common/src/cams/cases';
import { CamsUser } from '../../../../common/src/cams/users';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { randomUUID } from 'node:crypto';
import { PaginationParameters } from '../../../../common/src/api/pagination';

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

  public async getCaseNotes(caseId: string): Promise<CaseNote[]> {
    return await this.caseNotesRepository.getNotesByCaseId(caseId);
  }

  public async archiveCaseNote(archiveRequest: CaseNoteDeleteRequest): Promise<UpdateResult> {
    if (archiveRequest.userId !== archiveRequest.sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const newArchiveNote: Partial<CaseNote> = {
      caseId: archiveRequest.caseId,
      id: archiveRequest.id,
      archivedOn: new Date().toISOString(),
      archivedBy: getCamsUserReference(archiveRequest.sessionUser),
    };
    return await this.caseNotesRepository.archiveCaseNote(newArchiveNote);
  }

  public async editCaseNote(noteEditRequest: CaseNoteEditRequest): Promise<CaseNote> {
    const noteInput = noteEditRequest.note;
    if (noteEditRequest.note.updatedBy.id !== noteEditRequest.sessionUser.id) {
      throw new ForbiddenError(MODULE_NAME, { message: 'User is not the creator of the note.' });
    }
    const dateOfEdit = new Date().toISOString();
    const newNote: CaseNote = {
      ...noteInput,
      id: randomUUID(),
      documentType: 'NOTE',
      previousVersionId: noteInput.id,
      updatedOn: dateOfEdit,
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
      createdBy: noteInput.createdBy,
      createdOn: noteInput.createdOn,
    };

    const archiveNote: Partial<CaseNote> = {
      id: noteInput.id,
      caseId: noteInput.caseId,
      archivedOn: dateOfEdit,
      archivedBy: getCamsUserReference(noteEditRequest.sessionUser),
    };

    const creationResponse = await this.caseNotesRepository.create(newNote);
    await this.caseNotesRepository.archiveCaseNote(archiveNote);
    return creationResponse;
  }

  public async migrateLegacyCaseNotesPage(pagination: PaginationParameters) {
    const notesPage = await this.caseNotesRepository.getLegacyCaseNotesPage(pagination);
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
}
