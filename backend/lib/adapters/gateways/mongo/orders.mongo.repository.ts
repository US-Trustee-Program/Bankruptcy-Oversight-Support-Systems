import { OrdersSearchPredicate } from '@common/api/search';
import { Order, TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { ApplicationContext } from '../../types/basic';
import { OrdersRepository, UpdateResult } from '../../../use-cases/gateways.types';
import QueryBuilder, { ConditionOrConjunction, Query } from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ORDERS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'orders';

const { and, orderBy, using } = QueryBuilder;

export class OrdersMongoRepository extends BaseMongoRepository implements OrdersRepository {
  private static referenceCount: number = 0;
  private static instance: OrdersMongoRepository;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!OrdersMongoRepository.instance) {
      OrdersMongoRepository.instance = new OrdersMongoRepository(context);
    }
    OrdersMongoRepository.referenceCount++;
    return OrdersMongoRepository.instance;
  }

  public static dropInstance() {
    if (OrdersMongoRepository.referenceCount > 0) {
      OrdersMongoRepository.referenceCount--;
    }
    if (OrdersMongoRepository.referenceCount < 1) {
      OrdersMongoRepository.instance?.client.close().then();
      OrdersMongoRepository.instance = null;
    }
  }

  public release() {
    OrdersMongoRepository.dropInstance();
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    try {
      const doc = using<Order>();
      const query = predicate ? doc('courtDivisionCode').contains(predicate.divisionCodes) : null;
      const results = await this.getAdapter<Order>().find(
        query,
        orderBy<Order>(['orderDate', 'ASCENDING']),
      );
      return results;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async read(id: string): Promise<Order> {
    try {
      const query = using<Order>()('id').equals(id);
      const result = await this.getAdapter<Order>().findOne(query);
      return result;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    try {
      const existingQuery = using<Order>()('id').equals(data.id);
      const adapter = this.getAdapter<Order>();
      const foundOrder = (await adapter.findOne(existingQuery)) as TransferOrder;

      const { docketSuggestedCaseNumber: _ignore, ...existingOrder } = foundOrder;
      const { id: _id, taskType: _taskType, caseId: _caseId, ...mutableProperties } = data;

      const updatedOrder: TransferOrder = {
        ...existingOrder,
        ...mutableProperties,
      } as TransferOrder;

      const replacementQuery = using<Order>()('id').equals(data.id);

      if (data.status === 'approved') {
        await this.getAdapter<Order>().replaceOne(replacementQuery, updatedOrder);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(order: Order): Promise<Order> {
    try {
      const adapter = this.getAdapter<Order>();
      const id = await adapter.insertOne(order);
      return { ...order, id };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createMany(orders: Order[]): Promise<Order[]> {
    try {
      if (!orders.length) {
        return [];
      }
      const adapter = this.getAdapter<Order>();
      const ids = await adapter.insertMany(orders);
      return orders.map((order, idx) => {
        return { ...order, id: ids[idx] };
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async findByCaseId(caseId: string): Promise<Order[]> {
    try {
      const query = using<TransferOrder>()('caseId').equals(caseId) as Query<Order>;
      const results = await this.getAdapter<Order>().find(query);
      return results;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const query = using<Order>()('id').equals(id);
      await this.getAdapter<Order>().deleteOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async findTransferOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<TransferOrder & { _id: string }>> {
    try {
      type TransferOrderQueryable = TransferOrder & { _id: string };
      const doc = using<TransferOrderQueryable>();
      const conditions = [doc('taskType').equals('transfer'), doc('taskDate').notExists()];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<TransferOrderQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<TransferOrderQueryable>().find(query, sortSpec, limit);
      return results;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async updateTransferOrderTaskDate(mongoId: string, taskDate: string): Promise<void> {
    try {
      type TransferOrderQueryable = TransferOrder & { _id: string };
      const query = using<TransferOrderQueryable>()('_id').equals(mongoId);
      await this.getAdapter<TransferOrderQueryable>().updateOne(query, {
        taskDate,
      } as Partial<TransferOrderQueryable>);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async updateManyByQuery<U>(
    query: ConditionOrConjunction<U>,
    update: object,
  ): Promise<UpdateResult> {
    try {
      return await this.getAdapter<U>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
