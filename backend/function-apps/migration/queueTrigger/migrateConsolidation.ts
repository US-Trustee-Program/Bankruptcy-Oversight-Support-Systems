import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { isAcmsEtlQueryItem } from '../../../lib/use-cases/acms-orders/acms-orders';

const MODULE_NAME = 'IMPORT_ACTION_MIGRATE_CONSOLIDATION';

async function migrateConsolidation(queueItem: unknown, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    if (!isAcmsEtlQueryItem(queueItem)) {
      throw new CamsError(MODULE_NAME, { message: 'Invalid ACMS migration ETL queue entry.' });
    }
    const { leadCaseId } = queueItem;
    const _result = await controller.migrateConsolidation(appContext, leadCaseId);
    // TODO: Write result to queue to to build a report with???
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export default migrateConsolidation;
