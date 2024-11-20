import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsConsolidation,
  Predicate,
  PredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
class AcmsOrdersController {
  private readonly useCase = new AcmsOrders();

  public async migrateConsolidation(
    context: ApplicationContext,
    existing: AcmsConsolidation,
  ): Promise<ConsolidationOrder> {
    return this.useCase.migrateConsolidation(context, existing);
  }

  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    return this.useCase.getPageCount(context, predicate);
  }

  public async getConsolidations(
    context: ApplicationContext,
    predicate: PredicateAndPage,
  ): Promise<AcmsConsolidation[]> {
    return this.useCase.getLeadCaseIds(context, predicate);
  }
}

export default AcmsOrdersController;
