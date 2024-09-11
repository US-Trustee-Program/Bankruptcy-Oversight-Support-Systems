import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { CosmosDbRepository } from './cosmos/cosmos.repository';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const CONTAINER_NAME: string = 'consolidations';

export default class ConsolidationOrdersCosmosDbRepository
  extends CosmosDbRepository<ConsolidationOrder>
  implements ConsolidationOrdersRepository
{
  constructor(context: ApplicationContext) {
    super(context, CONTAINER_NAME, MODULE_NAME);
  }
  public async search(
    context: ApplicationContext,
    predicate?: OrdersSearchPredicate,
  ): Promise<Array<ConsolidationOrder>> {
    let querySpec;
    if (!predicate) {
      querySpec = {
        query: 'SELECT * FROM c ORDER BY c.orderDate ASC',
        parameters: [],
      };
    } else {
      // TODO: Sanitize the inputs
      // Group designator comes from local-storage-gateway and is store in the user session cache.
      // We get associated division codes from DXTR and also store that in the session cache.
      // We are not ever trusting the client with this information as of 9 Sept 2024.
      const whereClause =
        'WHERE ' +
        predicate.divisionCodes.map((dCode) => `c.courtDivisionCode='${dCode}'`).join(' OR ') +
        ' ORDER BY c.orderDate ASC';
      querySpec = {
        query: 'SELECT * FROM c ' + whereClause,
        parameters: [],
      };
    }
    return await this.query(context, querySpec);
  }
}
