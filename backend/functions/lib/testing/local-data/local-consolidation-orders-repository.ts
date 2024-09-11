import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { LocalCosmosDbRepository } from './local-cosmos-db-repository';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';

export class LocalConsolidationOrdersRepository
  extends LocalCosmosDbRepository<ConsolidationOrder>
  implements ConsolidationOrdersRepository
{
  async search(
    _context: ApplicationContext,
    _predicate?: OrdersSearchPredicate,
  ): Promise<ConsolidationOrder[]> {
    return [...this.container];
  }
}
