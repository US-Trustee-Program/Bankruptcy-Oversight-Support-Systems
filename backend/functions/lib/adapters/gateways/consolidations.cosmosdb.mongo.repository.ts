import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { deferClose } from '../../defer-close';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import QueryBuilder, { ConditionOrConjunction } from '../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsDocument } from '../../../../../common/src/cams/document';
import { getDocumentCollectionAdapter } from '../../factory';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const COLLECTION_NAME = 'consolidations';

const { and, contains, equals } = QueryBuilder;

export default class ConsolidationOrdersCosmosMongoDbRepository<
  T extends CamsDocument = ConsolidationOrder,
> implements ConsolidationOrdersRepository<T>
{
  private dbAdapter: MongoCollectionAdapter<T>;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    const client = new DocumentClient(connectionString);
    this.dbAdapter = getDocumentCollectionAdapter<T>(
      MODULE_NAME,
      client.database(databaseName).collection(COLLECTION_NAME),
    );
    deferClose(context, client);
  }

  async read(id: string): Promise<T> {
    try {
      const query = QueryBuilder.build(
        equals<ConsolidationOrder['consolidationId']>('consolidationId', id),
      );
      // TODO: WTH? Awaited<T>
      return await this.dbAdapter.findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(data: T): Promise<T> {
    try {
      const response = await this.dbAdapter.insertOne(data);
      data.id = response;
      return data;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async createMany(list: T[]): Promise<void> {
    try {
      await this.dbAdapter.insertMany(list);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async delete(id: string) {
    try {
      const query = QueryBuilder.build(equals<ConsolidationOrder['id']>('id', id));
      await this.dbAdapter.deleteOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async search(predicate?: OrdersSearchPredicate): Promise<Array<T>> {
    const conditions: ConditionOrConjunction[] = [];
    if (predicate.divisionCodes) {
      conditions.push(contains<string[]>('courtDivisionCode', predicate.divisionCodes));
    }
    if (predicate.consolidationId) {
      conditions.push(equals<string>('consolidationId', predicate.consolidationId));
    }
    const query = predicate ? QueryBuilder.build(and(...conditions)) : null;

    // TODO: We need to apply good fences to the sort parameter.
    return await this.dbAdapter.find(query, { orderDate: 1 });
  }
}
