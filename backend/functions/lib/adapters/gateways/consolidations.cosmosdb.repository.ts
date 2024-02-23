import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../types/basic';
import { CosmosDbCrudRepository } from './cosmos/cosmos.repository';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const CONTAINER_NAME: string = 'consolidations';

export default class ConsolidationOrdersCosmosDbRepository extends CosmosDbCrudRepository<ConsolidationOrder> {
  constructor(context: ApplicationContext) {
    super(context, CONTAINER_NAME, MODULE_NAME);
  }
  public async getAll(context: ApplicationContext): Promise<Array<ConsolidationOrder>> {
    const querySpec = {
      query: 'SELECT * FROM c ORDER BY c.orderDate ASC',
      parameters: [],
    };
    return await this.query(context, querySpec);
  }
}
