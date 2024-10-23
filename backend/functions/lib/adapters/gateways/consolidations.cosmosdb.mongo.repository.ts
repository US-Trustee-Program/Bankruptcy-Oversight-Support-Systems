import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { NotFoundError } from '../../common-errors/not-found-error';
import { Closable, deferClose } from '../../defer-close';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import QueryBuilder, { ConditionOrConjunction } from '../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { DocumentQuery } from './document-db.repository';
import { toMongoQuery } from '../../query/mongo-query-renderer';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';

const { and, contains, equals } = QueryBuilder;

export default class ConsolidationOrdersCosmosMongoDbRepository
  implements ConsolidationOrdersRepository, Closable
{
  private documentClient: DocumentClient;
  private readonly collectionName = 'consolidations';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.documentDbConfig.connectionString);
    deferClose(context, this);
  }

  async close() {
    await this.documentClient.close();
  }

  async read(context: ApplicationContext, id: string): Promise<ConsolidationOrder> {
    const { equals } = QueryBuilder;
    const query = QueryBuilder.build(
      toMongoQuery,
      equals<ConsolidationOrder['consolidationId']>('consolidationId', id),
    );
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);
    const response = await collection.findOne(query);
    if (response === null) {
      throw new NotFoundError(MODULE_NAME, {
        message: `Consolidation with ${id} cannot be found.`,
      });
    }
    return response;
  }

  async create(context: ApplicationContext, data: ConsolidationOrder): Promise<ConsolidationOrder> {
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);
    const response = await collection.insertOne(data);
    if (!response.acknowledged) {
      // TODO: then what??
    }
    data.id = response.insertedId.toString();
    return data;
  }

  public async createMany(context: ApplicationContext, list: ConsolidationOrder[]): Promise<void> {
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);
    const response = await collection.insertMany(list);

    if (!response.acknowledged) {
      // TODO: then what??
    }
    if (response.insertedCount != list.length) {
      // TODO: then what??
    }
  }

  public async delete(context: ApplicationContext, id: string, partitionKey: string) {
    // TODO: How to handle the partitionKey? (shard)
    // TODO: deleteOne returns a DeleteResult. This is different from the prior return.
    const query = QueryBuilder.build(
      toMongoQuery,
      and(
        equals<ConsolidationOrder['id']>('id', id),
        equals<ConsolidationOrder['consolidationId']>('consolidationId', partitionKey),
      ),
    );
    await this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection(this.collectionName)
      .deleteOne(query);
  }

  public async search(
    context: ApplicationContext,
    predicate?: OrdersSearchPredicate,
  ): Promise<Array<ConsolidationOrder>> {
    const conditions: ConditionOrConjunction[] = [];
    if (predicate.divisionCodes) {
      conditions.push(contains<string[]>('courtDivisionCode', predicate.divisionCodes));
    }
    if (predicate.consolidationId) {
      conditions.push(equals<string>('consolidationId', predicate.consolidationId));
    }
    const query: DocumentQuery = predicate
      ? QueryBuilder.build(toMongoQuery, and(...conditions))
      : {};

    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<ConsolidationOrder>(this.collectionName);

    const result = (await collection.find(query)).sort({ orderDate: 1 });
    const orders: ConsolidationOrder[] = [];
    for await (const doc of result) {
      orders.push(doc);
    }
    return orders;
  }
}
