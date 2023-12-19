import { getAssignmentRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentHistory } from '../../adapters/types/case.assignment';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';

export class CaseHistoryUseCase {
  private assignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(applicationContext: ApplicationContext) {
    this.assignmentRepository = getAssignmentRepository(applicationContext);
  }

  public async getCaseHistory(caseId: string): Promise<CaseAssignmentHistory[]> {
    return this.assignmentRepository.getAssignmentHistory(caseId);
  }
}
