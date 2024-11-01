import { OrdersSearchPredicate } from '../../../../../../common/src/api/search';
import { ConsolidationOrder } from '../../../../../../common/src/cams/orders';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsDocument } from '../../../../../../common/src/cams/document';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME: string = 'CONSOLIDATIONS_MONGO_REPOSITORY';
const COLLECTION_NAME = 'consolidations';

const { and, contains, equals, orderBy } = QueryBuilder;

export default class ConsolidationOrdersMongoRepository<T extends CamsDocument = ConsolidationOrder>
  extends BaseMongoRepository
  implements ConsolidationOrdersRepository<T>
{
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
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
