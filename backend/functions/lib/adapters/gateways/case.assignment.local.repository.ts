import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';

const MODULE_NAME = 'LOCAL-ASSIGNMENT-REPOSITORY';

export class CaseAssignmentLocalRepository implements CaseAssignmentRepositoryInterface {
  private caseAttorneyAssignments: CaseAttorneyAssignment[] = [];
  private nextUnusedId = 1;
  private appContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.appContext = context;
  }

  public async createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
    const assignmentId = this.nextUnusedId;
    caseAssignment.id = assignmentId.toString();
    this.caseAttorneyAssignments.push(caseAssignment);
    log.info(this.appContext, MODULE_NAME, caseAssignment.name);
    ++this.nextUnusedId;
    return assignmentId.toString();
  }

  public async getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => assignment.id === assignmentId);
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return this.caseAttorneyAssignments.filter((assignment) => assignment.caseId === caseId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignmentsByAssigneeName(attorney: string): Promise<CaseAttorneyAssignment[]> {
    return Promise.resolve([]);
  }
}
