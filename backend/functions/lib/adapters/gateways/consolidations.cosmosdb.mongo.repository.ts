import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { Closable } from '../../defer-close';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import QueryBuilder from '../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';

// const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';

export default class ConsolidationOrdersCosmosMongoDbRepository
  implements ConsolidationOrdersRepository, Closable
{
  private documentClient: DocumentClient;
  private collectionName = 'consolidations';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.cosmosConfig.mongoDbConnectionString);
  }

  async close() {
    await this.documentClient.close();
  }

  async get(context: ApplicationContext, id: string): Promise<ConsolidationOrder> {
    const { equals } = QueryBuilder;
    const query = QueryBuilder.build(
      equals<ConsolidationOrder['consolidationId']>('consolidationId', id),
    );
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);
    return await collection.findOne(query);
  }

  update(
    _context: ApplicationContext,
    _id: string,
    _partitionKey: string,
    _data: ConsolidationOrder,
  ) {
    throw new Error('Method not implemented.');
  }

  upsert(
    _context: ApplicationContext,
    _partitionKey: string,
    _data: ConsolidationOrder,
  ): Promise<ConsolidationOrder> {
    throw new Error('Method not implemented.');
  }

  async put(context: ApplicationContext, data: ConsolidationOrder): Promise<ConsolidationOrder> {
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);
    await collection.insertOne(data);
    return data;
  }

  putAll(_context: ApplicationContext, _list: ConsolidationOrder[]): Promise<ConsolidationOrder[]> {
    throw new Error('Method not implemented.');

    // return this.repo.putAll(context, list);
  }

  delete(_context: ApplicationContext, _id: string, _partitionKey: string) {
    throw new Error('Method not implemented.');

    // return this.repo.delete(context, id, partitionKey);
  }

  public async search(
    _context: ApplicationContext,
    _predicate?: OrdersSearchPredicate,
  ): Promise<Array<ConsolidationOrder>> {
    throw new Error('Method not implemented.');

    // let querySpec;
    // if (!predicate) {
    //   querySpec = {
    //     query: 'SELECT * FROM c ORDER BY c.orderDate ASC',
    //     parameters: [],
    //   };
    // } else {
    //   // TODO: Sanitize the inputs
    //   // Group designator comes from local-storage-gateway and is store in the user session cache.
    //   // We get associated division codes from DXTR and also store that in the session cache.
    //   // We are not ever trusting the client with this information as of 9 Sept 2024.
    //   const whereClause =
    //     'WHERE ' +
    //     predicate.divisionCodes.map((dCode) => `c.courtDivisionCode='${dCode}'`).join(' OR ') +
    //     ' ORDER BY c.orderDate ASC';
    //   querySpec = {
    //     query: 'SELECT * FROM c ' + whereClause,
    //     parameters: [],
    //   };
    // }
    // return await this.repo.query(context, querySpec);
  }
}
