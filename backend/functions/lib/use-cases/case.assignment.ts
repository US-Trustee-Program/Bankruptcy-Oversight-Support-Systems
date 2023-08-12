import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyAssignmentResponseInterface } from '../adapters/types/case.assignment';
import log from '../adapters/services/logger.service';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { AssignmentException } from './assignment.exception';

const NAMESPACE = 'CASE-ASSIGNMENT';
const EXISTING_ASSIGNMENT_FOUND =
  'A trial attorney assignment already exists for this case. Cannot create another assignment on an existing case assignment.';
export class CaseAssignment {
  private _assignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(assignmentRepository?: CaseAssignmentRepositoryInterface) {
    if (!assignmentRepository) {
      this._assignmentRepository = getAssignmentRepository();
    } else {
      this._assignmentRepository = assignmentRepository;
    }
  }

  async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    try {
      return await this._assignmentRepository.createAssignment(context, caseAssignment);
    } catch (exception) {
      //Log the exception and handle depending.
      log.error(applicationContextCreator(context), NAMESPACE, exception.message);
      throw exception;
    }
  }

  async createTrialAttorneyAssignments(
    context: ApplicationContext,
    listOfAssignments: CaseAttorneyAssignment[],
  ): Promise<AttorneyAssignmentResponseInterface> {
    const isValid = await this.isCreateValid(context, listOfAssignments);
    if (!isValid) {
      throw new AssignmentException(400, EXISTING_ASSIGNMENT_FOUND);
    } else {
      const listOfAssignmentIdsCreated: number[] = [];
      for (const assignment of listOfAssignments) {
        const assignmentId = await this.createAssignment(context, assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }

      return {
        success: true,
        message: 'Trial attorney assignments created.',
        resultCount: listOfAssignmentIdsCreated.length,
        assignmentIdList: listOfAssignmentIdsCreated,
      };
    }
  }

  async isCreateValid(
    context: ApplicationContext,
    newAssignments: CaseAttorneyAssignment[],
  ): Promise<boolean> {
    const caseId = newAssignments[0].caseId;
    const existingAssignments = await this._assignmentRepository.findAssignmentByCaseId(caseId);
    if (existingAssignments.length === 0) return true;
    return await this.isExactEqual(existingAssignments, newAssignments);
  }

  async isExactEqual(
    existingAssignments: CaseAttorneyAssignment[],
    newAssignments: CaseAttorneyAssignment[],
  ): Promise<boolean> {
    if (existingAssignments.length != newAssignments.length) {
      return false;
    } else {
      //compare each assignment
      for (let i = 0; i < existingAssignments.length; i++) {
        if (
          existingAssignments[i].attorneyId !== newAssignments[i].attorneyId ||
          existingAssignments[i].role !== newAssignments[i].role
        ) {
          return false;
        }
      }
      return true;
    }
  }
}
