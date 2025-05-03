import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getOfficeAssigneesRepository } from '../../factory';

const MODULE_NAME = 'CASE-CLOSED-EVENT-USE-CASE';

export type CaseClosedEvent = {
  caseId: string;
};

async function deleteCaseAssignment(context: ApplicationContext, caseId: string) {
  const repo = getOfficeAssigneesRepository(context);
  await repo.deleteMany({ caseId });
}

async function handleCaseClosedEvent(context: ApplicationContext, event: CaseClosedEvent) {
  try {
    await deleteCaseAssignment(context, event.caseId);
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

const CaseClosedEventUseCase = {
  handleCaseClosedEvent,
};

export default CaseClosedEventUseCase;
