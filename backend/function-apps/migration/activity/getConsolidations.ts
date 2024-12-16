import { InvocationContext } from '@azure/functions';
import { AcmsPredicateAndPage } from '../../../lib/use-cases/acms-orders/acms-orders';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT_ACTION_GET_CONSOLIDATIONS';

async function getConsolidations(
  input: AcmsPredicateAndPage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    return await controller.getLeadCaseIds(context, input);
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME, 'Failed to get lead case ids.');
    logger.camsError(error);
    return [];
  }
}

export default {
  handler: getConsolidations,
};
