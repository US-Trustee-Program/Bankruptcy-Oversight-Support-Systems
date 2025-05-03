import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { getCaseIdParts } from '../../../../common/src/cams/cases';
import { mapDivisionCodeToUstpOffice } from '../../../../common/src/cams/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getOfficeAssigneesRepository, getOfficesGateway } from '../../factory';
import { OfficeAssignee } from '../gateways.types';

const MODULE_NAME = 'OFFICE-ASSIGNEES-USE-CASE';

export type CaseClosedEvent = {
  caseId: string;
};

async function createCaseAssignment(
  context: ApplicationContext,
  assignee: OfficeAssignee,
): Promise<void> {
  const repo = getOfficeAssigneesRepository(context);
  await repo.create(assignee);
}

async function deleteCaseAssignment(
  context: ApplicationContext,
  assignee: OfficeAssignee,
): Promise<void> {
  const repo = getOfficeAssigneesRepository(context);
  const { caseId, userId } = assignee;
  await repo.deleteMany({ caseId, userId });
}

async function getDivisionCodeMap(context: ApplicationContext) {
  const gateway = getOfficesGateway(context);
  const offices = await gateway.getOffices(context);
  return mapDivisionCodeToUstpOffice(offices);
}

async function handleCaseAssignmentEvent(
  context: ApplicationContext,
  event: CaseAssignment,
): Promise<void> {
  try {
    const { caseId, name, userId } = event;

    const map = await getDivisionCodeMap(context);
    const { divisionCode } = getCaseIdParts(caseId);

    const assignee: OfficeAssignee = {
      caseId,
      name,
      officeCode: map.get(divisionCode).officeCode,
      userId,
    };

    if (event.unassignedOn) {
      await deleteCaseAssignment(context, assignee);
    } else {
      await createCaseAssignment(context, assignee);
    }
  } catch (originalError) {
    throw getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: 'Failed to handle case assignment event.',
        module: MODULE_NAME,
      },
      data: event,
    });
  }
}

async function handleCaseClosedEvent(
  context: ApplicationContext,
  event: CaseClosedEvent,
): Promise<void> {
  try {
    const repo = getOfficeAssigneesRepository(context);
    await repo.deleteMany({ caseId: event.caseId });
  } catch (originalError) {
    throw getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: 'Failed to handle case closed event.',
        module: MODULE_NAME,
      },
      data: event,
    });
  }
}

const OfficeAssigneesUseCase = {
  handleCaseAssignmentEvent,
  handleCaseClosedEvent,
};

export default OfficeAssigneesUseCase;
