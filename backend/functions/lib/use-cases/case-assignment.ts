import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository, getCasesRepository } from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import { CasesRepository } from './gateways.types';
import {
  AttorneyAssignmentResponseInterface,
  CaseAssignment,
} from '../../../../common/src/cams/assignments';
import { CaseAssignmentHistory } from '../../../../common/src/cams/history';
import CaseManagement from './case-management';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../common/src/cams/session';

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
    newAssignments: CamsUserReference[],
    role: string,
    options: { processRoles?: CamsRole[] } = {},
  ): Promise<AttorneyAssignmentResponseInterface> {
    const userAndProcessRoles = [].concat(context.session.user.roles).concat(options.processRoles);
    if (!userAndProcessRoles.includes(CamsRole.CaseAssignmentManager)) {
      return {
        success: false,
        message: 'User does not have appropriate access to create assignments.',
        count: 0,
        body: [],
      };
    }
    const caseManagement = new CaseManagement(context);
    const bCase = await caseManagement.getCaseSummary(context, caseId);
    const offices = context.session.user.offices.map((office) => office.courtDivisionCode);
    if (!offices.includes(bCase.courtDivisionCode)) {
      return {
        success: false,
        message: 'User does not have appropriate access to create assignments for this office.',
        count: 0,
        body: [],
      };
    }
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
    newAssignments: CamsUserReference[],
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
        userId: attorney.id,
        name: attorney.name,
        role: CamsRole[role],
        assignedOn: currentDate,
        changedBy: getCamsUserReference(context.session!.user),
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
      changedBy: getCamsUserReference(context.session!.user),
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

  public async getCaseLoad(userId: string): Promise<number> {
    const assignments = await this.getCaseAssignments(userId);
    return assignments.length;
  }

  public async getCaseAssignments(userId: string): Promise<CaseAssignment[]> {
    const assignments = await this.assignmentRepository.findAssignmentsByAssignee(userId);
    return assignments;
  }
}
