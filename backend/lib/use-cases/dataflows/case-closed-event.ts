import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-CLOSED-EVENT-USE-CASE';

type CaseClosedEvent = {
  caseId: string;
};

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

async function deleteCaseAssignment(context: ApplicationContext, caseId: string) {
  const repo = Factory.getOfficeAssigneesRepository(context);
  await repo.deleteMany({ caseId });
}

const CaseClosedEventUseCase = {
  handleCaseClosedEvent,
};

export default CaseClosedEventUseCase;
