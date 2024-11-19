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

// properties here are temporary.  Need to figure out what this type should look like.
export type AcmsConsolidation = {
  orderId: string;
  caseId: string;
};

export class AcmsOrders {
  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getPageCount(context, predicate);
  }

  public async getConsolidationOrders(
    context: ApplicationContext,
    predicateAndPage: PredicateAndPage,
  ): Promise<AcmsConsolidation[]> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getConsolidationOrders(context, predicateAndPage);
  }

  public async migrateExistingConsolidation(
    context: ApplicationContext,
    consolidation: AcmsConsolidation,
  ): Promise<ConsolidationOrder> {
    // NOTE! Azure suggests that all work be IDEMPOTENT because activities run _at least once_.
    context.logger.info(MODULE_NAME, 'Transform and load', consolidation);
    const newOrder = {
      ...consolidation,
      camsId: randomUUID(),
    };
    context.logger.info(
      MODULE_NAME,
      `Persisting ACMS consolidation ${newOrder.orderId} to CAMS ${newOrder.camsId}.`,
    );
    return newOrder as unknown as ConsolidationOrder;
  }
}

export default AcmsOrders;
