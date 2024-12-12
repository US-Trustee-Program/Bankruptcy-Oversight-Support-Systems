import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsTransformationResult,
  AcmsPredicate,
  AcmsPredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'ACMS-ORDERS-CONTROLLER';

class AcmsOrdersController {
  private readonly useCase = new AcmsOrders();

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsTransformationResult> {
    try {
      return await this.useCase.migrateConsolidation(context, leadCaseId);
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Migration consolidation failed in the use case.',
      );
      context.logger.error(MODULE_NAME, error.message, error);
      return { leadCaseId, childCaseCount: 0, success: false };
    }
  }

  public async getPageCount(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<number> {
    try {
      return await this.useCase.getPageCount(context, predicate);
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'Failed to get page count.');
      context.logger.error(MODULE_NAME, error.message, error);
      return 0;
    }
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicateAndPage,
  ): Promise<string[]> {
    try {
      return await this.useCase.getLeadCaseIds(context, predicate);
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'Failed to find lead case ids.');
      context.logger.error(MODULE_NAME, error.message, error);
      return [];
    }
  }
}

export default AcmsOrdersController;
