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

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const COLLECTION_NAME = 'consolidations';

const { and, contains, equals, orderBy } = QueryBuilder;

export default class ConsolidationOrdersCosmosMongoDbRepository<
  T extends CamsDocument = ConsolidationOrder,
> implements ConsolidationOrdersRepository<T>
{
  private readonly client: DocumentClient;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(context, this.client);
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }

  async read(id: string): Promise<T> {
    try {
      const query = QueryBuilder.build(
        equals<ConsolidationOrder['consolidationId']>('consolidationId', id),
      );
      return await this.getAdapter<T>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(data: T): Promise<T> {
    try {
      const response = await this.getAdapter<T>().insertOne(data);
      data.id = response;
      return data;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async createMany(list: T[]): Promise<void> {
    try {
      await this.getAdapter<T>().insertMany(list);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async delete(id: string) {
    try {
      const query = QueryBuilder.build(equals<ConsolidationOrder['id']>('id', id));
      await this.getAdapter<T>().deleteOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async search(predicate?: OrdersSearchPredicate): Promise<Array<T>> {
    const conditions: ConditionOrConjunction[] = [];

    try {
      if (predicate?.divisionCodes) {
        conditions.push(contains<string[]>('courtDivisionCode', predicate.divisionCodes));
      }
      if (predicate?.consolidationId) {
        conditions.push(equals<string>('consolidationId', predicate.consolidationId));
      }
      const query = predicate ? QueryBuilder.build(and(...conditions)) : null;
      return await this.getAdapter<T>().find(query, orderBy(['orderDate', 'ASCENDING']));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
