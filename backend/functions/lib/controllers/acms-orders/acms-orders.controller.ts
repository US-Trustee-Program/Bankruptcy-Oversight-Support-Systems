import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsConsolidation,
  Predicate,
  PredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
class AcmsOrdersController {
  public async migrateExistingConsolidation(
    context: ApplicationContext,
    existing: AcmsConsolidation,
  ): Promise<ConsolidationOrder> {
    const useCase = new AcmsOrders();
    return useCase.migrateExistingConsolidation(context, existing);
  }

  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    // TODO: Reconcile the argument type
    const useCase = new AcmsOrders();
    return useCase.getPageCount(context, predicate);
  }

  public async getConsolidationOrders(
    context: ApplicationContext,
    predicate: PredicateAndPage,
  ): Promise<AcmsConsolidation[]> {
    const useCase = new AcmsOrders();
    return useCase.getConsolidationOrders(context, predicate);
  }
}

export default AcmsOrdersController;
