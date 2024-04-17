import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { LocalCosmosDbRepository } from './local-cosmos-db-repository';

export class LocalConsolidationOrdersRepository
  extends LocalCosmosDbRepository<ConsolidationOrder>
  implements ConsolidationOrdersRepository
{
  async getAll(_context: ApplicationContext): Promise<ConsolidationOrder[]> {
    return [...this.container];
  }
}
