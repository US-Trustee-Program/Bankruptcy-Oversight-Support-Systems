import { OrdersSearchPredicate } from '@common/api/search';
import { ConsolidationOrder } from '@common/cams/orders';
import QueryBuilder, { ConditionOrConjunction, Query, using } from '../../../query/query-builder';
import { ConsolidationOrdersRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { escapeRegExCharacters } from '@common/cams/regex';

const MODULE_NAME = 'CONSOLIDATIONS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'consolidations';

const { and, orderBy } = QueryBuilder;

// MongoDB document shape: orderType replaces taskType in the domain model.
// ConsolidationOrderDbBase uses the concrete ConsolidationOrder so TypeScript can enumerate
// keys for query building. The generic ConsolidationOrderDb<T> is used only for insert/replace
// operations where the actual T subtype matters.
type ConsolidationOrderDbBase = Omit<ConsolidationOrder, 'taskType'> & {
  orderType: ConsolidationOrder['taskType'];
};
type ConsolidationOrderDbBaseQueryable = ConsolidationOrderDbBase & { _id: string };
type ConsolidationOrderDb<T extends ConsolidationOrder> = Omit<T, 'taskType'> & {
  orderType: T['taskType'];
};

export default class ConsolidationOrdersMongoRepository<
  T extends ConsolidationOrder = ConsolidationOrder,
>
  extends BaseMongoRepository
  implements ConsolidationOrdersRepository<T>
{
  private static referenceCount: number = 0;
  private static instance: ConsolidationOrdersMongoRepository;

  private dbDoc = using<ConsolidationOrderDbBase>();

  private fromDb(doc: ConsolidationOrderDbBase): ConsolidationOrder {
    const { orderType, ...rest } = doc;
    if (orderType !== undefined) {
      return { ...rest, taskType: orderType };
    }
    return rest as ConsolidationOrder;
  }

  private toDb(item: T): ConsolidationOrderDb<T> {
    const { taskType, ...rest } = item as T & { taskType: T['taskType'] };
    return { ...rest, orderType: taskType } as ConsolidationOrderDb<T>;
  }

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
      const query = this.dbDoc('consolidationId').equals(id);
      const result = await this.getAdapter<ConsolidationOrderDbBase>().findOne(query);
      return this.fromDb(result) as T;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(data: T): Promise<T> {
    try {
      const response = await this.getAdapter<ConsolidationOrderDb<T>>().insertOne(this.toDb(data));
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
      await this.getAdapter<ConsolidationOrderDb<T>>().insertMany(
        list.map((item) => this.toDb(item)),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async delete(id: string) {
    try {
      const query = this.dbDoc('id').equals(id);
      await this.getAdapter<ConsolidationOrderDbBase>().deleteOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async search(predicate?: OrdersSearchPredicate): Promise<Array<T>> {
    const conditions: ConditionOrConjunction<ConsolidationOrderDbBase>[] = [];

    try {
      if (predicate?.divisionCodes) {
        conditions.push(this.dbDoc('courtDivisionCode').contains(predicate.divisionCodes));
      }
      if (predicate?.consolidationId) {
        conditions.push(this.dbDoc('consolidationId').equals(predicate.consolidationId));
      }
      const query = predicate ? and(...conditions) : null;
      const results = await this.getAdapter<ConsolidationOrderDbBase>().find(
        query,
        orderBy<ConsolidationOrderDbBase>(['orderDate', 'ASCENDING']),
      );
      return results.map((d) => this.fromDb(d) as T);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async update(data: T): Promise<T> {
    try {
      const query = this.dbDoc('consolidationId').equals(data.consolidationId);
      const existingRaw = await this.getAdapter<ConsolidationOrderDbBase>().findOne(query);
      const existing = this.fromDb(existingRaw) as T;

      const {
        id: _id,
        consolidationId: _consolidationId,
        jobId: _jobId,
        ...mutableProperties
      } = data;

      const updated: T = {
        ...existing,
        ...mutableProperties,
      };

      const result = await this.getAdapter<ConsolidationOrderDb<T>>().replaceOne(
        query as Query<ConsolidationOrderDb<T>>,
        this.toDb(updated),
      );
      if (result.modifiedCount === 1) {
        return updated;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async count(keyRoot: string): Promise<number> {
    const doc = using<ConsolidationOrderDbBase>();
    try {
      const regex = new RegExp(`^${escapeRegExCharacters(keyRoot)}`);
      const query = doc('consolidationId').regex(regex);
      return await this.getAdapter<ConsolidationOrderDbBase>().countDocuments(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async updateManyByQuery<U>(query: ConditionOrConjunction<U>, update: unknown) {
    try {
      return await this.getAdapter<U>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findByCaseId(caseId: string): Promise<T[]> {
    try {
      type ConsolidationOrderDbQueryable = ConsolidationOrderDbBase & {
        'memberCases.caseId': string;
      };
      const doc = using<ConsolidationOrderDbQueryable>();
      const query = doc('memberCases.caseId').equals(caseId);
      const results = await this.getAdapter<ConsolidationOrderDbQueryable>().find(query);
      return results.map((d) => this.fromDb(d) as T);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findConsolidationOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<ConsolidationOrder & { _id: string }>> {
    try {
      const doc = using<ConsolidationOrderDbBaseQueryable>();
      // orderType is the MongoDB field name; domain model uses taskType after fromDb() mapping
      const conditions = [doc('orderType').equals('consolidation'), doc('taskDate').notExists()];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<ConsolidationOrderDbBaseQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<ConsolidationOrderDbBaseQueryable>().find(
        query,
        sortSpec,
        limit,
      );
      return results.map((d) => ({ ...this.fromDb(d), _id: d._id }));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async updateConsolidationOrderTaskDate(mongoId: string, taskDate: string): Promise<void> {
    try {
      type ConsolidationQueryable = ConsolidationOrder & { _id: string };
      const query = using<ConsolidationQueryable>()('_id').equals(mongoId);
      await this.getAdapter<ConsolidationQueryable>().updateOne(query, {
        taskDate,
      } as Partial<ConsolidationQueryable>);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findConsolidationOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<ConsolidationOrder & { _id: string }>> {
    try {
      type ConsolidationQueryable = ConsolidationOrder & { _id: string };
      const doc = using<ConsolidationQueryable>();
      const conditions = [doc('orderType').equals('consolidation'), doc('taskDate').notExists()];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<ConsolidationQueryable>(['_id', 'ASCENDING']);
      return await this.getAdapter<ConsolidationQueryable>().find(query, sortSpec, limit);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async updateConsolidationOrderTaskDate(mongoId: string, taskDate: string): Promise<void> {
    try {
      type ConsolidationQueryable = ConsolidationOrder & { _id: string };
      const query = using<ConsolidationQueryable>()('_id').equals(mongoId);
      await this.getAdapter<ConsolidationQueryable>().updateOne(query, {
        taskDate,
      } as Partial<ConsolidationQueryable>);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
