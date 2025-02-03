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

  public async getCaseIdsToSync(context: ApplicationContext): Promise<string[]> {
    try {
      const caseIds = await this.useCase.getCaseIdsToMigrate(context);
      return caseIds;
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'Failed to find case IDs to sync.');
      context.logger.error(MODULE_NAME, error.message, error);
      throw error;
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

  public async getCaseIdsToMigrate(context: ApplicationContext): Promise<string[]> {
    try {
      return this.useCase.getCaseIdsToMigrate(context);
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME, 'Failed to find case ids to migrate.');
      context.logger.error(MODULE_NAME, error.message, error);
      throw error;
    }
  }
}

export default AcmsOrdersController;
