import { ApplicationContext } from '../../adapters/types/basic';
import { getCaseNotesRepository } from '../../factory';
import { CaseNotesRepository, UpdateResult } from '../gateways.types';
import { CaseNote, CaseNoteInput } from '../../../../common/src/cams/cases';
import { CamsUser } from '../../../../common/src/cams/users';
import { getTodaysIsoDate } from '../../../../common/src/date-helper';

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
      updatedOn: getTodaysIsoDate(),
    };

    await this.caseNotesRepository.create(data);
  }

  public async getCaseNotes(caseId: string): Promise<CaseNote[]> {
    const notes = this.caseNotesRepository.getNotesByCaseId(caseId);
    return notes;
  }

  public async archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult> {
    const newArchiveNote: Partial<CaseNote> = {
      caseId: archiveNote.caseId,
      id: archiveNote.id,
      archivedOn: new Date().toISOString(),
    };
    return await this.caseNotesRepository.archiveCaseNote(newArchiveNote);
  }
}
