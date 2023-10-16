import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyAssignmentResponseInterface } from '../adapters/types/case.assignment';
import log from '../adapters/services/logger.service';
import { AssignmentError } from './assignment.exception';

const MODULE_NAME = 'CASE-ASSIGNMENT';
const EXISTING_ASSIGNMENT_FOUND =
  'A trial attorney assignment already exists for this case. Cannot create another assignment on an existing case assignment.';
export class CaseAssignment {
  private assignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(
    context: ApplicationContext,
    assignmentRepository?: CaseAssignmentRepositoryInterface,
  ) {
    if (!assignmentRepository) {
      this.assignmentRepository = getAssignmentRepository(context);
    } else {
      this.assignmentRepository = assignmentRepository;
    }
  }

  public async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<string> {
    try {
      return await this.assignmentRepository.createAssignment(caseAssignment);
    } catch (exception) {
      log.error(context, MODULE_NAME, exception.message);
      throw exception;
    }
  }

  public async createTrialAttorneyAssignments(
    context: ApplicationContext,
    listOfAssignments: CaseAttorneyAssignment[],
  ): Promise<AttorneyAssignmentResponseInterface> {
    const isValid = await this.isCreateValid(context, listOfAssignments);
    if (!isValid) {
      throw new AssignmentError(MODULE_NAME, { message: EXISTING_ASSIGNMENT_FOUND });
    } else {
      const listOfAssignmentIdsCreated: string[] = [];
      for (const assignment of listOfAssignments) {
        const assignmentId = await this.createAssignment(context, assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }

      return {
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAssignmentIdsCreated.length,
        body: listOfAssignmentIdsCreated,
      };
    }
  }

  public async isCreateValid(
    context: ApplicationContext,
    newAssignments: CaseAttorneyAssignment[],
  ): Promise<boolean> {
    const caseId = newAssignments[0].caseId;
    const existingAssignments = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    return existingAssignments.length === 0;
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
