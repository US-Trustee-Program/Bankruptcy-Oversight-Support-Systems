import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import {
  AttorneyAssignmentResponseInterface,
  CaseAssignment,
  CaseAssignmentHistory,
} from '../adapters/types/case.assignment';
import log from '../adapters/services/logger.service';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';

const MODULE_NAME = 'CASE-ASSIGNMENT';

export class CaseAssignmentUseCase {
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

    const listOfAssignments: CaseAssignment[] = [];
    const attorneys = [...new Set(newAssignments)];
    const currentDate = new Date().toISOString();
    attorneys.forEach((attorney) => {
      const assignment: CaseAssignment = {
        documentType: 'ASSIGNMENT',
        caseId: caseId,
        name: attorney,
        role: CaseAssignmentRole[role],
        assignedOn: currentDate,
      };
      listOfAssignments.push(assignment);
    });
    const listOfAssignmentIdsCreated: string[] = [];

    const existingAssignmentRecords =
      await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    for (const existingAssignment of existingAssignmentRecords) {
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
      const existingAssignment = existingAssignmentRecords.find((ea) => {
        return ea.name === assignment.name && ea.role === assignment.role;
      });
      if (!existingAssignment) {
        const assignmentId = await this.assignmentRepository.createAssignment(assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }
    }

    const newAssignmentRecords = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    const history: CaseAssignmentHistory = {
      caseId,
      documentType: 'ASSIGNMENT_HISTORY',
      occurredAtTimestamp: currentDate,
      previousAssignments: existingAssignmentRecords,
      newAssignments: newAssignmentRecords,
    };
    await this.assignmentRepository.createAssignmentHistory(history);

    log.info(
      applicationContext,
      MODULE_NAME,
      `Updated assignments for case number ${caseId}.`,
      listOfAssignmentIdsCreated,
    );

    // TODO: Maybe return the updated assignment state for the case, i.e. the new attorney list.
    return {
      success: true,
      message: 'Trial attorney assignments created.',
      count: listOfAssignmentIdsCreated.length,
      body: listOfAssignmentIdsCreated,
    };
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
