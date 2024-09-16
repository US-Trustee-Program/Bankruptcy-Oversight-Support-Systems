import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository, getCasesRepository } from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import { CasesRepository } from './gateways.types';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { CaseAssignmentHistory } from '../../../../common/src/cams/history';
import CaseManagement from './case-management';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { AssignmentError } from './assignment.exception';
import { createAuditRecord } from '../../../../common/src/cams/auditable';

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
  ): Promise<void> {
    const userAndProcessRoles = [].concat(context.session.user.roles).concat(options.processRoles);
    if (!userAndProcessRoles.includes(CamsRole.CaseAssignmentManager)) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'User does not have appropriate access to create assignments.',
      });
    }
    const caseManagement = new CaseManagement(context);
    const bCase = await caseManagement.getCaseSummary(context, caseId);
    const offices = context.session.user.offices.map((office) => office.courtDivisionCode);
    if (!offices.includes(bCase.courtDivisionCode)) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'User does not have appropriate access to create assignments for this office.',
      });
    }
    await this.assignTrialAttorneys(context, caseId, newAssignments, role);

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
      const assignment = createAuditRecord<CaseAssignment>(
        {
          documentType: 'ASSIGNMENT',
          caseId: caseId,
          userId: attorney.id,
          name: attorney.name,
          role: CamsRole[role],
          assignedOn: currentDate,
        },
        context.session?.user,
      );
      assignment.updatedOn = currentDate;
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
    const history = createAuditRecord<CaseAssignmentHistory>(
      {
        caseId,
        documentType: 'AUDIT_ASSIGNMENT',
        before: existingAssignmentRecords,
        after: newAssignmentRecords,
      },
      context.session?.user,
    );
    history.updatedOn = currentDate;
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
