import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsConsolidationReport,
  Predicate,
  PredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
class AcmsOrdersController {
  private readonly useCase = new AcmsOrders();

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidationReport> {
    return this.useCase.migrateConsolidation(context, leadCaseId);
  }

  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    return this.useCase.getPageCount(context, predicate);
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: PredicateAndPage,
  ): Promise<string[]> {
    return this.useCase.getLeadCaseIds(context, predicate);
  }
}

export default AcmsOrdersController;
