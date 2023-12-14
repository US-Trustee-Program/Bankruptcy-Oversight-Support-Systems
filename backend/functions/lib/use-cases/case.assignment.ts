import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyAssignmentResponseInterface } from '../adapters/types/case.assignment';
import log from '../adapters/services/logger.service';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';

const MODULE_NAME = 'CASE-ASSIGNMENT';
export class CaseAssignment {
  private assignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(applicationContext: ApplicationContext) {
    this.assignmentRepository = getAssignmentRepository(applicationContext);
  }

  public async createTrialAttorneyAssignments(
    applicationContext: ApplicationContext,
    caseId: string,
    newAssignments: string[],
    role: string,
  ): Promise<AttorneyAssignmentResponseInterface> {
    log.info(applicationContext, MODULE_NAME, 'New assignments:', newAssignments);

    const listOfAssignments: CaseAttorneyAssignment[] = [];
    const attorneys = [...new Set(newAssignments)];
    const currentDate = new Date().toISOString();
    attorneys.forEach((attorney) => {
      const assignment: CaseAttorneyAssignment = {
        caseId: caseId,
        name: attorney,
        role: CaseAssignmentRole[role],
        assignedOn: currentDate,
      };
      listOfAssignments.push(assignment);
    });
    const listOfAssignmentIdsCreated: string[] = [];

    const existingAssignments = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    for (const existingAssignment of existingAssignments) {
      const stillAssigned = listOfAssignments.find((newAssignment) => {
        return (
          newAssignment.name === existingAssignment.name &&
          newAssignment.role === existingAssignment.role
        );
      });
      if (!stillAssigned) {
        await this.assignmentRepository.updateAssignment({
          ...existingAssignment,
          unassignedOn: new Date().toISOString(),
        });
      }
    }

    for (const assignment of listOfAssignments) {
      const existingAssignment = existingAssignments.find((ea) => {
        return ea.name === assignment.name && ea.role === assignment.role;
      });
      if (!existingAssignment) {
        const assignmentId = await this.assignmentRepository.createAssignment(assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }
    }

    log.info(
      applicationContext,
      MODULE_NAME,
      `Updated assignments for case number ${caseId}.`,
      listOfAssignmentIdsCreated,
    );

    // TODO: Maybe return the updated assignement state for the case, i.e. the new attorney list.
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
