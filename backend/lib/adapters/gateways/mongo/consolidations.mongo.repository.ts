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

type ConsolidationOrderQueryable = ConsolidationOrder & {
  'memberCases.caseId': string;
};

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

  private fromDb(doc: Record<string, unknown>): T {
    const { orderType, ...rest } = doc;
    return { ...rest, taskType: orderType } as T;
  }

  private toDb(item: T): Record<string, unknown> {
    const { taskType, ...rest } = item as unknown as Record<string, unknown>;
    return { ...rest, orderType: taskType };
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
      const query = this.doc('consolidationId').equals(id);
      const result = await this.getAdapter<Record<string, unknown>>().findOne(
        query as unknown as Query<Record<string, unknown>>,
      );
      return this.fromDb(result);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(data: T): Promise<T> {
    try {
      const response = await this.getAdapter<Record<string, unknown>>().insertOne(
        this.toDb(data) as unknown as Record<string, unknown>,
      );
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
      await this.getAdapter<Record<string, unknown>>().insertMany(
        list.map((item) => this.toDb(item) as unknown as Record<string, unknown>),
      );
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
      const results = await this.getAdapter<Record<string, unknown>>().find(
        query as unknown as Query<Record<string, unknown>>,
        orderBy<Record<string, unknown>>(['orderDate', 'ASCENDING']),
      );
      return results.map((d) => this.fromDb(d));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async update(data: T): Promise<T> {
    try {
      const query = this.doc('consolidationId').equals(data.consolidationId);
      const existingRaw = await this.getAdapter<Record<string, unknown>>().findOne(
        query as unknown as Query<Record<string, unknown>>,
      );
      const existing = this.fromDb(existingRaw);

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

      const result = await this.getAdapter<Record<string, unknown>>().replaceOne(
        query as unknown as Query<Record<string, unknown>>,
        this.toDb(updated) as unknown as Record<string, unknown>,
      );
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

  public async updateManyByQuery<U>(query: ConditionOrConjunction<U>, update: unknown) {
    try {
      return await this.getAdapter<U>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findByCaseId(caseId: string): Promise<T[]> {
    try {
      const doc = using<ConsolidationOrderQueryable>();
      const query = doc('memberCases.caseId').equals(caseId);
      const results = await this.getAdapter<Record<string, unknown>>().find(
        query as unknown as Query<Record<string, unknown>>,
      );
      return results.map((d) => this.fromDb(d));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findConsolidationOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<ConsolidationOrder & { _id: string }>> {
    try {
      type DbQueryable = Record<string, unknown> & { _id: string };
      const doc = using<DbQueryable>();
      const conditions = [doc('orderType').equals('consolidation'), doc('taskDate').notExists()];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<DbQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<DbQueryable>().find(query, sortSpec, limit);
      return results.map((d) => this.fromDb(d) as unknown as ConsolidationOrder & { _id: string });
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
