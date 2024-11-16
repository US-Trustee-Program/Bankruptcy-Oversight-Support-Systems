import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../model';
import { OrdersUseCase } from '../../lib/use-cases/orders/orders';
import {
  getCasesRepository,
  getCasesGateway,
  getOrdersRepository,
  getOrdersGateway,
  getRuntimeStateRepository,
  getConsolidationOrdersRepository,
  getStorageGateway,
} from '../../lib/factory';
import { OrderSyncState } from '../../lib/use-cases/gateways.types';
import ContextCreator from '../../azure/application-context-creator';
import { CamsError } from '../../lib/common-errors/cams-error';

const MODULE_NAME = 'IMPORT-ACTION-GET-PAGE-COUNT';

async function getPageCount(input: PredicateAndPage, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const context = await ContextCreator.applicationContextCreator(invocationContext, logger);

    // Do some stuff
    console.log('#################GetPageCount', JSON.stringify(input));
    // TODO: This seems silly to have to supply all of these repos and gateways.
    // Are we going to add yet another for ACMS?
    const orders = new OrdersUseCase(
      getCasesRepository(context),
      getCasesGateway(context),
      getOrdersRepository(context),
      getOrdersGateway(context),
      getRuntimeStateRepository<OrderSyncState>(context),
      getConsolidationOrdersRepository(context),
      getStorageGateway(context),
    );

    return orders.getConsolidationPageCount(context, {});
  } catch (originalError) {
    throw new CamsError(MODULE_NAME, { originalError });
  }
}

export default {
  handler: getPageCount,
};
