import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsTransformationResult,
  AcmsPredicate,
} from '../../use-cases/acms-orders/acms-orders';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'ACMS-ORDERS-CONTROLLER';

class AcmsOrdersController {
  private readonly useCase: AcmsOrders;

  constructor() {
    this.useCase = new AcmsOrders();
  }

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsTransformationResult> {
    try {
      return await this.useCase.migrateConsolidation(context, leadCaseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Migration consolidation failed.');
    }
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<string[]> {
    try {
      const leadCaseIds = await this.useCase.getLeadCaseIds(context, predicate);
      return leadCaseIds;
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'Failed to find lead case ids.');
      context.logger.error(MODULE_NAME, error.message, error);
      throw error;
    }
  }
}

export default AcmsOrdersController;
