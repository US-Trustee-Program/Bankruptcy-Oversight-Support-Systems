import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentRequest } from '../types/case.assignment.request';
import { CaseAssignmentResponse } from '../types/case.assignment';

export class AssignmentController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async createCaseAssignment(assignmentRequest: CaseAssignmentRequest): Promise<CaseAssignmentResponse>{
    //Call the UseCase with the request info.
  }
}