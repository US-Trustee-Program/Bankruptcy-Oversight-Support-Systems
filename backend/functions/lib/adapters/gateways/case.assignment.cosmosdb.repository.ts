import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';

export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    throw new Error('Method not implemented.' + context + caseAssignment);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAssignment(assignmentId: number): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignment(caseAssignment: CaseAttorneyAssignment): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }
  getCount(): Promise<number> {
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignmentByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    throw new Error('Method not implemented.');
  }
}
