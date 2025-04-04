import { ApplicationContext } from '../../adapters/types/basic';
import { getOfficeAssigneesRepository, getOfficesGateway } from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { mapDivisionCodeToUstpOffice } from '../../../../common/src/cams/offices';

const MODULE_NAME = 'CASE-ASSIGNMENT-EVENT-USE-CASE';

export type OfficeAssignee = {
  caseId: string;
  officeCode: string;
  userId: string;
  name: string;
};

async function getDivisionCodeMap(context: ApplicationContext) {
  const gateway = getOfficesGateway(context);
  const offices = await gateway.getOffices(context);
  return mapDivisionCodeToUstpOffice(offices);
}

async function handleCaseAssignmentEvent(context: ApplicationContext, event: CaseAssignment) {
  try {
    const { caseId, userId, name } = event;

    const map = await getDivisionCodeMap(context);
    const divisionCode = caseId.substring(0, 3);

    const assignee: OfficeAssignee = {
      officeCode: map.get(divisionCode).officeCode,
      caseId,
      userId,
      name,
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

async function createCaseAssignment(context: ApplicationContext, assignee: OfficeAssignee) {
  const repo = getOfficeAssigneesRepository(context);
  await repo.create(assignee);
}

async function deleteCaseAssignment(context: ApplicationContext, assignee: OfficeAssignee) {
  const repo = getOfficeAssigneesRepository(context);
  const { caseId, userId } = assignee;
  await repo.deleteMany({ caseId, userId });
}

const CaseAssignmentEventUseCase = {
  handleCaseAssignmentEvent,
};

export default CaseAssignmentEventUseCase;
