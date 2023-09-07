import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignment } from '../../use-cases/case.assignment';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import log from '../services/logger.service';
import { AssignmentException } from '../../use-cases/assignment.exception';
import { CaseAssignmentRole } from '../types/case.assignment.role';

const NAMESPACE = 'ASSIGNMENT-CONTROLLER';

export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async createTrialAttorneyAssignments(params: {
    caseId: string;
    listOfAttorneyNames: string[];
    role: CaseAssignmentRole;
  }): Promise<AttorneyAssignmentResponseInterface> {
    try {
      const listOfAssignments: CaseAttorneyAssignment[] = [];

      const attorneys = [...new Set(params.listOfAttorneyNames)];
      attorneys.forEach((attorney) => {
        const assignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
          params.caseId,
          attorney,
          params.role,
        );
        listOfAssignments.push(assignment);
      });
      const assignmentUseCase = new CaseAssignment(this.applicationContext);
      return assignmentUseCase.createTrialAttorneyAssignments(
        this.applicationContext,
        listOfAssignments,
      );
    } catch (exception) {
      log.error(this.applicationContext, NAMESPACE, exception.message);
      if (!(exception instanceof AssignmentException)) {
        throw new AssignmentException(500, exception.message);
      } else {
        throw new AssignmentException(exception.status, exception.message);
      }
    }
  }

  public async getAllAssignments(): Promise<CaseAttorneyAssignment[]> {
    const assignmentUseCase = new CaseAssignment(this.applicationContext);
    return assignmentUseCase.getAllAssignments();
  }
}
