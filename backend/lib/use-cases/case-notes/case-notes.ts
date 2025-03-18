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

const MODULE_NAME = 'CASE-NOTES-USE-CASE';

export class CaseNotesUseCase {
  private caseNotesRepository: CaseNotesRepository;
  constructor(applicationContext: ApplicationContext) {
    this.caseNotesRepository = getCaseNotesRepository(applicationContext);
  }

  public async createCaseNote(user: CamsUser, noteInput: CaseNoteInput): Promise<void> {
    const data: CaseNote = {
      ...noteInput,
      documentType: 'NOTE',
      updatedBy: {
        id: user.id,
        name: user.name,
      },
      updatedOn: new Date().toISOString(),
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
      previousVersionId: noteInput.id,
      updatedOn: dateOfEdit,
      documentType: 'NOTE',
      updatedBy: getCamsUserReference(noteEditRequest.sessionUser),
    };

    const archiveNote: Partial<CaseNote> = {
      id: noteInput.id,
      caseId: noteInput.caseId,
      archivedOn: dateOfEdit,
      archivedBy: getCamsUserReference(noteEditRequest.sessionUser),
    };
    await this.caseNotesRepository.archiveCaseNote(archiveNote);
    return await this.caseNotesRepository.create(newNote);
  }
}
