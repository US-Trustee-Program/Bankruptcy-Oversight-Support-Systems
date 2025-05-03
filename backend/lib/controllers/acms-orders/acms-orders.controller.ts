import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import AcmsOrders, {
  AcmsPredicate,
  AcmsTransformationResult,
} from '../../use-cases/dataflows/migrate-consolidations';

const MODULE_NAME = 'ACMS-ORDERS-CONTROLLER';

class AcmsOrdersController {
  private readonly useCase: AcmsOrders;

  constructor() {
    this.useCase = new AcmsOrders();
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
}

export default AcmsOrdersController;
