import { OrdersSearchPredicate } from '@common/api/search';
import { Order, TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { ApplicationContext } from '../../types/basic';
import { OrdersRepository } from '../../../use-cases/gateways.types';
import QueryBuilder, { Query } from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ORDERS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'orders';

const { and, orderBy, using } = QueryBuilder;

// MongoDB document shape: orderType replaces taskType in the domain model
type OrderDb = Omit<Order, 'taskType'> & { orderType: Order['taskType'] };
type TransferOrderDbQueryable = Omit<TransferOrder, 'taskType'> & {
  orderType: TransferOrder['taskType'];
  _id: string;
};

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

  private fromDb(doc: OrderDb): Order {
    const { orderType, ...rest } = doc;
    if (orderType !== undefined) {
      return { ...rest, taskType: orderType } as Order;
    }
    return rest as Order;
  }

  private toDb(item: Order | TransferOrderAction): OrderDb {
    const { taskType, ...rest } = item as Order & { taskType: Order['taskType'] };
    return { ...rest, orderType: taskType } as OrderDb;
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    try {
      const doc = using<Order>();
      const query = predicate ? doc('courtDivisionCode').contains(predicate.divisionCodes) : null;
      const results = await this.getAdapter<OrderDb>().find(
        query as unknown as Query<OrderDb>,
        orderBy<OrderDb>(['orderDate', 'ASCENDING']),
      );
      return results.map((d) => this.fromDb(d));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async read(id: string): Promise<Order> {
    try {
      const doc = using<Order>();
      const query = doc('id').equals(id);
      const result = await this.getAdapter<OrderDb>().findOne(query as unknown as Query<OrderDb>);
      return this.fromDb(result);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    try {
      const existingQuery = using<TransferOrder>()('id').equals(data.id);

      const adapter = this.getAdapter<OrderDb>();
      const foundRaw = await adapter.findOne(existingQuery as unknown as Query<OrderDb>);
      const foundOrder = this.fromDb(foundRaw) as TransferOrder;

      const { docketSuggestedCaseNumber: _ignore, ...existingOrder } = foundOrder;
      const { id: _id, taskType: _taskType, caseId: _caseId, ...mutableProperties } = data;

      const updatedOrder: TransferOrderAction = {
        ...existingOrder,
        ...mutableProperties,
      };

      const replacementQuery = using<TransferOrderAction>()('id').equals(data.id);

      if (data.status === 'approved') {
        await this.getAdapter<OrderDb>().replaceOne(
          replacementQuery as unknown as Query<OrderDb>,
          this.toDb(updatedOrder),
        );
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async create(order: Order): Promise<Order> {
    try {
      const adapter = this.getAdapter<OrderDb>();
      const id = await adapter.insertOne(this.toDb(order));
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
      const adapter = this.getAdapter<OrderDb>();
      const ids = await adapter.insertMany(orders.map((o) => this.toDb(o)));
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
      const results = await this.getAdapter<OrderDb>().find(query as unknown as Query<OrderDb>);
      return results.map((d) => this.fromDb(d));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const doc = using<Order>();
      const query = doc('id').equals(id);
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
      const doc = using<TransferOrderDbQueryable>();
      // orderType is the MongoDB field name; domain model uses taskType after fromDb() mapping
      const conditions = [doc('orderType').equals('transfer'), doc('taskDate').notExists()];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<TransferOrderDbQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<TransferOrderDbQueryable>().find(
        query,
        sortSpec,
        limit,
      );
      return results.map((d) => this.fromDb(d) as TransferOrder & { _id: string });
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
}
