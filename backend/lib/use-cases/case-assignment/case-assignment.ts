import Factory, { getAssignmentRepository, getQueueGateway } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentRepository, QueueGateway } from '../gateways.types';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { CaseAssignmentHistory } from '../../../../common/src/cams/history';
import CaseManagement from '../cases/case-management';
import { CamsUserReference, getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { AssignmentError } from './assignment.exception';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import OfficeAssigneesUseCase from '../offices/office-assignees';

const MODULE_NAME = 'CASE-ASSIGNMENT';

export class CaseAssignmentUseCase {
  private context: ApplicationContext;
  private assignmentRepository: CaseAssignmentRepository;
  private queueGateway: QueueGateway;

  constructor(applicationContext: ApplicationContext) {
    this.context = applicationContext;
    this.assignmentRepository = getAssignmentRepository(applicationContext);
    this.queueGateway = getQueueGateway(applicationContext);
  }

  public async createTrialAttorneyAssignments(
    context: ApplicationContext,
    caseId: string,
    newAssignments: CamsUserReference[],
    role: string,
    options: { processRoles?: CamsRole[] } = {},
  ): Promise<void> {
    const casesRepo = Factory.getCasesRepository(context);
    const userAndProcessRoles = [].concat(context.session.user.roles).concat(options.processRoles);
    if (!userAndProcessRoles.includes(CamsRole.CaseAssignmentManager)) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'User does not have appropriate access to create assignments.',
      });
    }
    const caseManagement = new CaseManagement(context);
    const bCase = await caseManagement.getCaseSummary(context, caseId);
    const offices = getCourtDivisionCodes(context.session.user);
    if (!offices.includes(bCase.courtDivisionCode)) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'User does not have appropriate access to create assignments for this office.',
      });
    }
    await this.assignTrialAttorneys(context, caseId, newAssignments, role);

    // Reassign all child cases if this is a joint administration lead case.
    const consolidationReferences = await casesRepo.getConsolidation(caseId);
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
    const casesRepo = Factory.getCasesRepository(context);
    const assignmentRepo = Factory.getAssignmentRepository(context);
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

    // TODO: Collect the additions and deletions and add them to the assignment change queue.
    const addedAssignments = [];
    const removedAssignments = [];

    const existingAssignmentRecordsMap = await assignmentRepo.getAssignmentsForCases([caseId]);
    const existingAssignmentRecords = existingAssignmentRecordsMap.get(caseId) ?? [];
    for (const existingAssignment of existingAssignmentRecords) {
      const stillAssigned = listOfAssignments.find((newAssignment) => {
        return (
          newAssignment.name === existingAssignment.name &&
          newAssignment.role === existingAssignment.role
        );
      });
      if (!stillAssigned) {
        const updatedAssignment = {
          ...existingAssignment,
          unassignedOn: new Date().toISOString(),
        };
        await assignmentRepo.update(updatedAssignment);
        removedAssignments.push(updatedAssignment);
      }
    }

    for (const assignment of listOfAssignments) {
      const existingAssignment = existingAssignmentRecords.find((ea) => {
        return ea.name === assignment.name && ea.role === assignment.role;
      });
      if (!existingAssignment) {
        addedAssignments.push(assignment);
        const assignmentId = await assignmentRepo.create(assignment);
        if (!listOfAssignmentIdsCreated.includes(assignmentId)) {
          listOfAssignmentIdsCreated.push(assignmentId);
        }
      }
    }

    const newAssignmentRecordsMap = await assignmentRepo.getAssignmentsForCases([caseId]);
    const newAssignmentRecords = newAssignmentRecordsMap.get(caseId);
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
    await casesRepo.createCaseHistory(history);

    for (const assignment of [...addedAssignments, ...removedAssignments]) {
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(context, assignment);
    }

    context.logger.info(
      MODULE_NAME,
      `Updated assignments for case number ${caseId}.`,
      listOfAssignmentIdsCreated,
    );
    return listOfAssignmentIdsCreated;
  }

  public async findAssignmentsByCaseId(caseIds: string[]): Promise<Map<string, CaseAssignment[]>> {
    const assignmentRepo = Factory.getAssignmentRepository(this.context);
    return await assignmentRepo.getAssignmentsForCases(caseIds);
  }

  public async getCaseLoad(userId: string): Promise<number> {
    const assignments = await this.getCaseAssignments(userId);
    return assignments.length;
  }

  public async getCaseAssignments(userId: string): Promise<CaseAssignment[]> {
    const assignmentRepo = Factory.getAssignmentRepository(this.context);
    return await assignmentRepo.findAssignmentsByAssignee(userId);
  }
}
