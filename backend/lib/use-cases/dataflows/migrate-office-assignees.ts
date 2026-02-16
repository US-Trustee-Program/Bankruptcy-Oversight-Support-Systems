import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import { mapDivisionCodeToUstpOffice } from '@common/cams/offices';
import { CaseAssignment } from '@common/cams/assignments';
import { isCaseOpen } from '@common/cams/cases';
import { OfficeAssignee } from '../gateways.types';
import { DocumentCountSummary } from '../dataflow.types';

const MODULE_NAME = 'MIGRATE-OFFICE-ASSIGNEES-USE-CASE';

async function migrateAssignments(context: ApplicationContext): Promise<DocumentCountSummary> {
  const assignmentsRepo = factory.getAssignmentRepository(context);
  const allAssignments = await assignmentsRepo.getAllActiveAssignments();

  const officesGateway = factory.getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);
  const divisionCodeMap = mapDivisionCodeToUstpOffice(offices);

  const casesRepo = factory.getCasesRepository(context);
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
      officeCode: divisionCodeMap.get(assignment.caseId.substring(0, 3)).officeCode,
      userId: assignment.userId,
      name: assignment.name,
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
    { success: 0, fail: 0 },
  );

  context.logger.info(MODULE_NAME, 'Office assignees migration results', summary);
  return summary;
}

async function createOfficeAssignee(
  context: ApplicationContext,
  assignee: OfficeAssignee,
): Promise<boolean> {
  const officeAssigneesRepo = factory.getOfficeAssigneesRepository(context);
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

const MigrateOfficeAssigneesUseCase = {
  migrateAssignments,
};

export default MigrateOfficeAssigneesUseCase;
