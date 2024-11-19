import {
  Predicate,
  PredicateAndPage,
  AcmsConsolidation,
} from '../../../use-cases/acms-orders/acms-orders';
import { AcmsGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';

const _MODULE_NAME = 'ACMS_GATEWAY';

export class AcmsGatewayImpl implements AcmsGateway {
  constructor(_context: ApplicationContext) {
    // TODO: setup database connection
  }

  async getPageCount(_context: ApplicationContext, _predicate: Predicate): Promise<number> {
    throw Error('getPageCount Not Implemented');
  }

  async getConsolidationOrders(
    _context: ApplicationContext,
    _predicateAndPage: PredicateAndPage,
  ): Promise<AcmsConsolidation[]> {
    throw Error('getConsolidationOrders Not Implemented');
  }
}
