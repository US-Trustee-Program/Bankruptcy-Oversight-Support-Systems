import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { randomUUID } from 'crypto';

const NAMESPACE = 'LOCAL-ASSIGNMENT-REPOSITORY';

export class CaseAssignmentLocalRepository implements CaseAssignmentRepositoryInterface {
  private caseAttorneyAssignments: CaseAttorneyAssignment[] = [];
  private nextUnusedId = 1;
  private appContext: ApplicationContext;
  private id: string;

  constructor(context: ApplicationContext) {
    this.appContext = context;
    this.id = randomUUID();
  }

  public async createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
    const assignmentId = this.nextUnusedId;
    caseAssignment.id = assignmentId.toString();
    this.caseAttorneyAssignments.push(caseAssignment);
    log.info(this.appContext, NAMESPACE, caseAssignment.attorneyName);
    ++this.nextUnusedId;
    console.log('Creating the assignment in:', this.id);
    return assignmentId.toString();
  }

  public async getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => assignment.id === assignmentId);
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return this.caseAttorneyAssignments.filter((assignment) => assignment.caseId === caseId);
  }

  public async getAllAssignments(): Promise<CaseAttorneyAssignment[]> {
    console.log('Reading the assignments in:', this.id);
    return this.caseAttorneyAssignments;
  }
}
