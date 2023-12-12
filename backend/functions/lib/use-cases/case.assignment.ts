import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyAssignmentResponseInterface } from '../adapters/types/case.assignment';
import log from '../adapters/services/logger.service';

const MODULE_NAME = 'CASE-ASSIGNMENT';
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
    caseId: string,
    newAssignments: CaseAttorneyAssignment[],
  ): Promise<AttorneyAssignmentResponseInterface> {
    const listOfAssignmentIdsCreated: string[] = [];

    // Unassign an existing attorney that does not appear in the new assignment list.
    const existingAssignments = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    for (const existingAssignment of existingAssignments) {
      const stillAssigned = newAssignments.find((newAssignment) => {
        newAssignment.name === existingAssignment.name &&
          newAssignment.role === existingAssignment.role;
      });
      if (!stillAssigned) {
        await this.assignmentRepository.updateAssignment({
          ...existingAssignment,
          unassignedOn: new Date().toISOString(),
        });
      }
    }

    // Add any attorney from the new assignment list to the case that is not already assigned.
    for (const assignment of newAssignments) {
      const existingAssignment = existingAssignments.find((ea) => {
        return ea.name === assignment.name && ea.role === assignment.role;
      });
      if (!existingAssignment) {
        const assignmentId = await this.createAssignment(assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }
    }

    log.info(
      applicationContext,
      MODULE_NAME,
      `Created ${listOfAssignmentIdsCreated.length} assignments for case number ${newAssignments[0].caseId}.`,
      listOfAssignmentIdsCreated,
    );
    return {
      success: true,
      message: 'Trial attorney assignments created.',
      count: listOfAssignmentIdsCreated.length,
      body: listOfAssignmentIdsCreated,
    };
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
