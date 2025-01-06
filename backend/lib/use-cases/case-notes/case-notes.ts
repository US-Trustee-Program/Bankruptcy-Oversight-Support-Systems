import { ApplicationContext } from '../../adapters/types/basic';
import { getCaseNotesRepository } from '../../factory';
import { CaseNotesRepository } from '../gateways.types';
import { CaseNote } from '../../../../common/src/cams/cases';
import { CamsUser } from '../../../../common/src/cams/users';

export class CaseNotesUseCase {
  private caseNotesRepository: CaseNotesRepository;

  constructor(applicationContext: ApplicationContext) {
    this.caseNotesRepository = getCaseNotesRepository(applicationContext);
  }

  public async createCaseNote(user: CamsUser, caseId: string, note: string): Promise<void> {
    const data: CaseNote = {
      documentType: 'NOTE',
      caseId,
      updatedBy: {
        id: user.id,
        name: user.name,
      },
      updatedOn: new Date().toISOString(),
      content: note,
    };

    await this.caseNotesRepository.create(data);
  }

  public async getCaseNotes(caseId: string): Promise<CaseNote[]> {
    const notes = this.caseNotesRepository.getNotesByCaseId(caseId);
    return notes;
  }
}
