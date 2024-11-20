import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { randomUUID } from 'crypto';

const MODULE_NAME = 'ACMS_ORDERS_USE_CASE';

export type Bounds = {
  divisionCodes: string[];
  chapters: string[];
};

export type Predicate = {
  divisionCode: string;
  chapter: string;
};

export type PredicateAndPage = Predicate & {
  pageNumber: number;
};

export class AcmsOrders {
  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getPageCount(context, predicate);
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicateAndPage: PredicateAndPage,
  ): Promise<string[]> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getLeadCaseIds(context, predicateAndPage);
  }

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<ConsolidationOrder> {
    // NOTE! Azure suggests that all work be IDEMPOTENT because activities run _at least once_.
    context.logger.info(MODULE_NAME, 'Transform and load', leadCaseId);
    const newOrder = {
      leadCaseId,
      camsId: randomUUID(),
    };
    context.logger.info(
      MODULE_NAME,
      `Persisting ACMS consolidation ${newOrder.leadCaseId} to CAMS ${newOrder.camsId}.`,
    );
    return newOrder as unknown as ConsolidationOrder;
  }
}

export default AcmsOrders;
