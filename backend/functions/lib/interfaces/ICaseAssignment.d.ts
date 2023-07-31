import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentResponse, CaseAssignmentRole } from '../adapters/types/case.assignment';

export interface ICaseAssignment {
  createAssignment(
    context: ApplicationContext,
    caseId: string,
    professionalId: string,
    role: CaseAssignmentRole,
  ): Promise<CaseAssignmentResponse>;
}
