import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { AcmsTransformationResult } from '../../../lib/use-cases/acms-orders/acms-orders';

const MODULE_NAME = 'IMPORT_ACTION_MIGRATE_CONSOLIDATION';

async function migrateConsolidation(
  leadCaseId: string,
  invocationContext: InvocationContext,
): Promise<AcmsTransformationResult> {
  const logger = ContextCreator.getLogger(invocationContext);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    const result = await controller.migrateConsolidation(appContext, leadCaseId);
    logger.debug(
      MODULE_NAME,
      `Migration result for leadCaseId ${leadCaseId}: ${result.success ? 'successful' : 'failed'}`,
    );
    return result;
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed to migrate consolidation for ${leadCaseId}.`,
    );
    logger.camsError(error);
    return { leadCaseId, childCaseCount: 0, success: false };
  }
}

export default {
  handler: migrateConsolidation,
};
