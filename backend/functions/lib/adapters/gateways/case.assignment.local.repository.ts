import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseAssignment, CaseAssignmentHistory } from '../types/case.assignment';

const MODULE_NAME = 'LOCAL-ASSIGNMENT-REPOSITORY';

export class CaseAssignmentLocalRepository implements CaseAssignmentRepositoryInterface {
  private caseAttorneyAssignments: CaseAssignment[] = [];
  private caseAttorneyAssignmentHistory: CaseAssignmentHistory[] = [];
  private nextUnusedId = 1;
  private applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const assignmentId = this.nextUnusedId;
    caseAssignment.id = assignmentId.toString();
    this.caseAttorneyAssignments.push(caseAssignment);
    log.info(this.applicationContext, MODULE_NAME, caseAssignment.name);
    ++this.nextUnusedId;
    return assignmentId.toString();
  }

  public async createAssignmentHistory(history: CaseAssignmentHistory): Promise<string> {
    const assignmentId = this.nextUnusedId;
    history.id = assignmentId.toString();
    this.caseAttorneyAssignmentHistory.push(history);
    ++this.nextUnusedId;
    return assignmentId.toString();
  }

  public async updateAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const index = this.caseAttorneyAssignments.findIndex(
      (assignment) => assignment.id === caseAssignment.id,
    );
    if (index >= 0) {
      this.caseAttorneyAssignments[index] = caseAssignment;
    } else {
      throw new UnknownError(MODULE_NAME, {
        message:
          'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
        originalError: new Error('Can not find record'),
        status: 500,
      });
    }
    log.info(this.applicationContext, MODULE_NAME, caseAssignment.name);
    return caseAssignment.id;
  }

  public async getAssignment(assignmentId: string): Promise<CaseAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => assignment.id === assignmentId);
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    return this.caseAttorneyAssignments.filter((assignment) => assignment.caseId === caseId);
  }

  public async findAssignmentsByAssigneeName(name: string): Promise<CaseAssignment[]> {
    return Promise.resolve(
      this.caseAttorneyAssignments.filter((a) => {
        return a.name === name;
      }),
    );
  }
}
