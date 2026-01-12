import { OrdersSearchPredicate } from '@common/api/search';
import { ConsolidationOrder } from '@common/cams/orders';
import QueryBuilder, { ConditionOrConjunction, using } from '../../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { escapeRegExCharacters } from '@common/cams/regex';

const MODULE_NAME = 'CONSOLIDATIONS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'consolidations';

const { and, orderBy } = QueryBuilder;

export default class ConsolidationOrdersMongoRepository<
  T extends ConsolidationOrder = ConsolidationOrder,
>
  extends BaseMongoRepository
  implements ConsolidationOrdersRepository<T>
{
  private static referenceCount: number = 0;
  private static instance: ConsolidationOrdersMongoRepository;

  private doc = using<T>();

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!ConsolidationOrdersMongoRepository.instance) {
      ConsolidationOrdersMongoRepository.instance = new ConsolidationOrdersMongoRepository(context);
    }
    ConsolidationOrdersMongoRepository.referenceCount++;
    return ConsolidationOrdersMongoRepository.instance;
  }

  public static dropInstance() {
    if (ConsolidationOrdersMongoRepository.referenceCount > 0) {
      ConsolidationOrdersMongoRepository.referenceCount--;
    }
    if (ConsolidationOrdersMongoRepository.referenceCount < 1) {
      ConsolidationOrdersMongoRepository.instance.client.close().then();
      ConsolidationOrdersMongoRepository.instance = null;
    }
  }

  public release() {
    ConsolidationOrdersMongoRepository.dropInstance();
  }

  async read(id: string): Promise<T> {
    try {
      const query = this.doc('consolidationId').equals(id);
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
    if (!list || !list.length) {
      return;
    }
    try {
      await this.getAdapter<T>().insertMany(list);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async delete(id: string) {
    try {
      const query = this.doc('id').equals(id);
      await this.getAdapter<T>().deleteOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async search(predicate?: OrdersSearchPredicate): Promise<Array<T>> {
    const conditions: ConditionOrConjunction<T>[] = [];

    try {
      if (predicate?.divisionCodes) {
        conditions.push(this.doc('courtDivisionCode').contains(predicate.divisionCodes));
      }
      if (predicate?.consolidationId) {
        conditions.push(this.doc('consolidationId').equals(predicate.consolidationId));
      }
      const query = predicate ? and(...conditions) : null;
      return await this.getAdapter<T>().find(query, orderBy(['orderDate', 'ASCENDING']));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async update(data: T): Promise<T> {
    try {
      const query = this.doc('consolidationId').equals(data.consolidationId);
      const existing = await this.getAdapter<T>().findOne(query);

      const {
        id: _id,
        consolidationId: _consolidationId,
        jobId: _jobId,
        ...mutableProperties
      } = data;

      const updated = {
        ...existing,
        ...mutableProperties,
      };

      const result = await this.getAdapter<T>().replaceOne(query, updated);
      if (result.modifiedCount === 1) {
        return updated;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async count(keyRoot: string): Promise<number> {
    const doc = using<ConsolidationOrder>();
    try {
      const regex = new RegExp(`^${escapeRegExCharacters(keyRoot)}`);
      const query = doc('consolidationId').regex(regex);
      return await this.getAdapter<T>().countDocuments(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
