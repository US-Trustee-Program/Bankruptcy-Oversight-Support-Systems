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
    applicationContext: ApplicationContext,
    assignmentRepository?: CaseAssignmentRepositoryInterface,
  ) {
    if (!assignmentRepository) {
      this.assignmentRepository = getAssignmentRepository(applicationContext);
    } else {
      this.assignmentRepository = assignmentRepository;
    }
  }

  public async createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
    return await this.assignmentRepository.createAssignment(caseAssignment);
  }

  public async createTrialAttorneyAssignments(
    applicationContext: ApplicationContext,
    listOfAssignments: CaseAttorneyAssignment[],
  ): Promise<AttorneyAssignmentResponseInterface> {
    const isValid = await this.isCreateValid(listOfAssignments);
    if (!isValid) {
      throw new AssignmentError(MODULE_NAME, { message: EXISTING_ASSIGNMENT_FOUND });
    } else {
      const listOfAssignmentIdsCreated: string[] = [];
      for (const assignment of listOfAssignments) {
        const assignmentId = await this.createAssignment(assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }

      log.info(
        applicationContext,
        MODULE_NAME,
        `Created ${listOfAssignmentIdsCreated.length} assignments for case number ${listOfAssignments[0].caseId}.`,
        listOfAssignmentIdsCreated,
      );
      return {
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAssignmentIdsCreated.length,
        body: listOfAssignmentIdsCreated,
      };
    }
  }

  public async isCreateValid(newAssignments: CaseAttorneyAssignment[]): Promise<boolean> {
    const caseId = newAssignments[0].caseId;
    try {
      const existingAssignments = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
      return existingAssignments.length === 0;
    } catch (e) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'Unable to determine whether assignments already exist.',
        originalError: e,
      });
    }
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
