import Factory, {
  getAssignmentRepository,
  getOfficesGateway,
  getOfficesRepository,
  getQueueGateway,
} from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentRepository, QueueGateway } from '../gateways.types';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseAssignmentHistory } from '@common/cams/history';
import CaseManagement from '../cases/case-management';
import { CamsUserReference, getCourtDivisionCodes } from '@common/cams/users';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { AssignmentError } from './assignment.exception';
import { createAuditRecord } from '@common/cams/auditable';
import OfficeAssigneesUseCase from '../offices/office-assignees';
import { mapDivisionCodeToUstpOffice } from '@common/cams/offices';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

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

  // TODO: createTrialAttorneyAssignments should not take a role, or should be renamed
  public async createTrialAttorneyAssignments(
    context: ApplicationContext,
    caseId: string,
    newAssignees: CamsUserReference[],
    role: string,
    options: { processRoles?: CamsRoleType[] } = {},
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
    await this.assignTrialAttorneys(context, caseId, newAssignees, role);

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
      await this.assignTrialAttorneys(context, childCaseId, newAssignees, role);
    }
  }

  // TODO: assignTrialAttorneys should not take a role, or should be renamed
  private async assignTrialAttorneys(
    context: ApplicationContext,
    caseId: string,
    newAssignees: CamsUserReference[],
    role: string,
  ): Promise<string[]> {
    const casesRepo = Factory.getCasesRepository(context);
    const assignmentRepo = Factory.getAssignmentRepository(context);
    context.logger.info(MODULE_NAME, 'New assignments:', newAssignees);

    const bCase = await casesRepo.getSyncedCase(caseId);
    const officesGateway = getOfficesGateway(context);
    const offices = await officesGateway.getOffices(context);
    const divisionCodeMap = mapDivisionCodeToUstpOffice(offices);
    const { officeCode } = divisionCodeMap.get(bCase.caseId.substring(0, 3));

    const officesRepo = getOfficesRepository(context);
    const calls = [];
    const validatedAssignments: CamsUserReference[] = [];
    newAssignees.forEach((assignee) => {
      calls.push(
        officesRepo
          .search({ officeCode, userId: assignee.id, role })
          .then((response) => {
            return response.find((staff) => {
              if (staff.roles.includes(role as CamsRoleType) && staff.name === assignee.name) {
                return true;
              }
            });
          })
          .catch((originalError) => {
            const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
              camsStackInfo: {
                module: MODULE_NAME,
                message: 'Failed while searching for assignments.',
              },
            });
            context.logger.camsError(error);
          }),
      );
    });
    await Promise.all(calls).then((responses) => {
      for (let i = 0; i < calls.length; i++) {
        if (responses[i]) {
          validatedAssignments.push({ id: responses[i].id, name: responses[i].name });
        }
      }
    });
    if (validatedAssignments.length !== newAssignees.length) {
      throw new AssignmentError(MODULE_NAME, {
        message: 'Invalid assignments found.',
        data: { newAssignments: newAssignees, validatedAssignments },
      });
    }

    const listOfAssignments: CaseAssignment[] = [];
    const attorneys = [...new Set(validatedAssignments)];
    const currentDate = new Date().toISOString();
    attorneys.forEach((attorney) => {
      const assignment = createAuditRecord<CaseAssignment>(
        {
          documentType: 'ASSIGNMENT',
          caseId: bCase.caseId,
          userId: attorney.id,
          name: attorney.name,
          role: CamsRole[role] as string,
          assignedOn: currentDate,
        },
        context.session?.user,
      );
      assignment.updatedOn = currentDate;
      listOfAssignments.push(assignment);
    });
    const listOfAssignmentIdsCreated: string[] = [];

    const addedAssignments = [];
    const removedAssignments = [];

    const existingAssignmentRecordsMap = await assignmentRepo.getAssignmentsForCases([
      bCase.caseId,
    ]);
    const existingAssignmentRecords = existingAssignmentRecordsMap.get(bCase.caseId) ?? [];
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

    const newAssignmentRecordsMap = await assignmentRepo.getAssignmentsForCases([bCase.caseId]);
    const newAssignmentRecords = newAssignmentRecordsMap.get(bCase.caseId);
    const history = createAuditRecord<CaseAssignmentHistory>(
      {
        caseId: bCase.caseId,
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
      `Updated assignments for case number ${bCase.caseId}.`,
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
