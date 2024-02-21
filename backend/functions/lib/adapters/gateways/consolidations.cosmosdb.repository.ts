import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../types/basic';
import { CosmosDbCrudRepository } from './cosmos/cosmos.repository';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const CONTAINER_NAME: string = 'consolidations';

export class ConsolidationOrdersCosmosDbRepository extends CosmosDbCrudRepository<ConsolidationOrder> {
  constructor(context: ApplicationContext) {
    super(context, CONTAINER_NAME, MODULE_NAME);
  }
}
