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
    listOfAssignments: CaseAttorneyAssignment[],
  ): Promise<AttorneyAssignmentResponseInterface> {
    const listOfAssignmentIdsCreated: string[] = [];

    const existingAssignments = await this.assignmentRepository.findAssignmentsByCaseId(caseId);
    for (const assignment of existingAssignments) {
      const alreadyAssigned = listOfAssignments.find((newAssignment) => {
        newAssignment.name === assignment.name && newAssignment.role === assignment.role;
      });
      if (!alreadyAssigned) {
        await this.assignmentRepository.updateAssignment({
          ...assignment,
          unassigned: true,
          unassignedOn: new Date().toISOString(),
        });
      }
    }

    for (const assignment of listOfAssignments) {
      if (!this.assignmentRepository.assignmentExists(assignment)) {
        const assignmentId = await this.createAssignment(assignment);
        // need to add an entry to history stating that assignment was created.
        if (!listOfAssignmentIdsCreated.includes(assignmentId))
          listOfAssignmentIdsCreated.push(assignmentId);
      }
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

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
