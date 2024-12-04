import { ApplicationContext } from '../../adapters/types/basic';
// import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import AcmsOrders, {
  AcmsConsolidationReport,
  AcmsPredicate,
  AcmsPredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
class AcmsOrdersController {
  private readonly useCase = new AcmsOrders();

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidationReport> {
    const response = this.useCase.migrateConsolidation(context, leadCaseId);
    // await finalizeDeferrable(context);
    return response;
  }

  public async getPageCount(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<number> {
    const response = this.useCase.getPageCount(context, predicate);
    // await finalizeDeferrable(context);
    return response;
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicateAndPage,
  ): Promise<string[]> {
    const response = this.useCase.getLeadCaseIds(context, predicate);
    // await finalizeDeferrable(context);
    return response;
  }
}

export default AcmsOrdersController;
