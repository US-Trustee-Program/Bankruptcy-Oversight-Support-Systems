import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository, getCasesRepository } from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { CasesRepository } from './gateways.types';
import {
  AttorneyAssignmentResponseInterface,
  CaseAssignment,
} from '../../../../common/src/cams/assignments';
import { CaseAssignmentHistory } from '../../../../common/src/cams/history';

const MODULE_NAME = 'CASE-ASSIGNMENT';

export class CaseAssignmentUseCase {
  private assignmentRepository: CaseAssignmentRepositoryInterface;
  private casesRepository: CasesRepository;

  constructor(applicationContext: ApplicationContext) {
    this.assignmentRepository = getAssignmentRepository(applicationContext);
    this.casesRepository = getCasesRepository(applicationContext);
  }

  public async createTrialAttorneyAssignments(
    context: ApplicationContext,
    caseId: string,
    newAssignments: string[],
    role: string,
  ): Promise<AttorneyAssignmentResponseInterface> {
    const assignmentIds = await this.assignTrialAttorneys(context, caseId, newAssignments, role);

    // Reassign all child cases if this is a joint administration lead case.
    const consolidationReferences = await this.casesRepository.getConsolidation(context, caseId);
    const childCaseIds = consolidationReferences
      .filter(
        (reference) =>
          reference.documentType === 'CONSOLIDATION_FROM' &&
          reference.consolidationType === 'administrative',
      )
      .map((reference) => reference.otherCase.caseId);
    for (const childCaseId of childCaseIds) {
      await this.assignTrialAttorneys(context, childCaseId, newAssignments, role);
    }

    return {
      success: true,
      message: 'Trial attorney assignments created.',
      count: assignmentIds.length,
      body: assignmentIds,
    };
  }

  private async assignTrialAttorneys(
    context: ApplicationContext,
    caseId: string,
    newAssignments: string[],
    role: string,
  ): Promise<string[]> {
    context.logger.info(MODULE_NAME, 'New assignments:', newAssignments);

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
      documentType: 'AUDIT_ASSIGNMENT',
      occurredAtTimestamp: currentDate,
      before: existingAssignmentRecords,
      after: newAssignmentRecords,
    };
    await this.casesRepository.createCaseHistory(context, history);

    context.logger.info(
      MODULE_NAME,
      `Updated assignments for case number ${caseId}.`,
      listOfAssignmentIdsCreated,
    );

    return listOfAssignmentIdsCreated;
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    return await this.assignmentRepository.findAssignmentsByCaseId(caseId);
  }

  public async getCaseLoad(name: string): Promise<number> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssigneeName(name);
    return assignments.length;
  }
}
