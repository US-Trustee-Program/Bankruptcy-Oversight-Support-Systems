import { ApplicationContext } from '../../adapters/types/basic';
import AcmsOrders, {
  AcmsTransformationResult,
  AcmsPredicate,
  AcmsPredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
class AcmsOrdersController {
  private readonly useCase = new AcmsOrders();

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsTransformationResult> {
    const response = this.useCase.migrateConsolidation(context, leadCaseId);
    return response;
  }

  public async getPageCount(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<number> {
    const response = this.useCase.getPageCount(context, predicate);
    return response;
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicateAndPage,
  ): Promise<string[]> {
    const response = this.useCase.getLeadCaseIds(context, predicate);
    return response;
  }
}

export default AcmsOrdersController;
