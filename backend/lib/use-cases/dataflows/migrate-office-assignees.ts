import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { isCaseOpen } from '../../../../common/src/cams/cases';
import { mapDivisionCodeToUstpOffice } from '../../../../common/src/cams/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import {
  getAssignmentRepository,
  getCasesRepository,
  getOfficeAssigneesRepository,
  getOfficesGateway,
} from '../../factory';
import { OfficeAssignee } from '../gateways.types';

const MODULE_NAME = 'MIGRATE-OFFICE-ASSIGNEES-USE-CASE';

async function createOfficeAssignee(
  context: ApplicationContext,
  assignee: OfficeAssignee,
): Promise<boolean> {
  const officeAssigneesRepo = getOfficeAssigneesRepository(context);
  let error: CamsError;
  try {
    await officeAssigneesRepo.create(assignee);
  } catch (originalError) {
    error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: `Failed writing assignment for userId: ${assignee.userId} to case: ${assignee.caseId}.`,
        module: MODULE_NAME,
      },
    });
    context.logger.camsError(error);
  }
  return !error;
}

async function migrateAssignments(context: ApplicationContext) {
  const assignmentsRepo = getAssignmentRepository(context);
  const allAssignments = await assignmentsRepo.getAllActiveAssignments();

  const officesGateway = getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);
  const divisionCodeMap = mapDivisionCodeToUstpOffice(offices);

  const casesRepo = getCasesRepository(context);
  const safeGetCase = async (caseId: string) => {
    try {
      return await casesRepo.getSyncedCase(caseId);
    } catch {
      return null;
    }
  };

  const filteredAssignments: CaseAssignment[] = [];
  for (const assignment of allAssignments) {
    const bCase = await safeGetCase(assignment.caseId);
    if (bCase && isCaseOpen(bCase)) {
      filteredAssignments.push(assignment);
    }
  }

  const officeAssignees: OfficeAssignee[] = filteredAssignments.map((assignment) => {
    return {
      caseId: assignment.caseId,
      name: assignment.name,
      officeCode: divisionCodeMap.get(assignment.caseId.substring(0, 3)).officeCode,
      userId: assignment.userId,
    };
  });

  const results = await Promise.all(
    officeAssignees.map((assignee) => createOfficeAssignee(context, assignee)),
  );

  const summary = results.reduce(
    (acc, success) => {
      if (success) {
        acc.success += 1;
      } else {
        acc.fail += 1;
      }
      return acc;
    },
    { fail: 0, success: 0 },
  );

  context.logger.info(MODULE_NAME, 'Office assignees migration results', summary);
}

const MigrateOfficeAssigneesUseCase = {
  migrateAssignments,
};

export default MigrateOfficeAssigneesUseCase;
