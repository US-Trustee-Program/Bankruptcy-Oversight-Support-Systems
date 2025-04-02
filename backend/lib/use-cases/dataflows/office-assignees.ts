import { ApplicationContext } from '../../adapters/types/basic';
import {
  getAssignmentRepository,
  getCasesRepository,
  getOfficeAssigneesRepository,
  getOfficesGateway,
} from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import { mapDivisionCodeToUstpOffice } from '../../../../common/src/cams/offices';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { isCaseOpen } from '../../../../common/src/cams/cases';

const MODULE_NAME = 'OFFICE-ASSIGNEES';

export type OfficeAssignee = {
  caseId: string;
  officeCode: string;
  userId: string;
  name: string;
};

async function migrateAssignments(context: ApplicationContext) {
  const assignmentsRepo = getAssignmentRepository(context);
  const allAssignments = await assignmentsRepo.getAllActiveAssignments();

  const officesGateway = getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);
  const divisionCodeMap = mapDivisionCodeToUstpOffice(offices);

  const casesRepo = getCasesRepository(context);
  const safeGetCase = async (caseId: string) => {
    try {
      return await casesRepo.getCase(caseId);
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

  // TODO: [how] do we want to collect metadata?
  const results = [];
  for (const assignee of officeAssignees) {
    results.push(await createOfficeAssignee(context, assignee));
  }

  return results;
}

async function createOfficeAssignee(context: ApplicationContext, assignee: OfficeAssignee) {
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
  }
  if (!error) {
    return { assignee, success: true };
  } else {
    return { assignee, success: false };
  }
}

const OfficeAssignees = {
  migrateAssignments,
};

export default OfficeAssignees;
