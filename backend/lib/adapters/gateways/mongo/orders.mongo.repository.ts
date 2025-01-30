import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../types/basic';
import { OrdersRepository } from '../../../use-cases/gateways.types';
import QueryBuilder, { Query } from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ORDERS_MONGO_REPOSITORY';
const COLLECTION_NAME = 'orders';

const { contains, equals, orderBy } = QueryBuilder;

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
      OrdersMongoRepository.instance.client.close().then();
      OrdersMongoRepository.instance = null;
    }
  }

  public release() {
    OrdersMongoRepository.dropInstance();
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: Query;
    if (!predicate) {
      query = null;
    } else {
      query = QueryBuilder.build(contains('courtDivisionCode', predicate.divisionCodes));
    }

    try {
      return await this.getAdapter<Order>().find(query, orderBy(['orderDate', 'ASCENDING']));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async read(id: string): Promise<Order> {
    try {
      const query = QueryBuilder.build(equals<string>('id', id));
      return await this.getAdapter<Order>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    const query = QueryBuilder.build(equals<string>('id', data.id));
    try {
      const adapter = this.getAdapter<TransferOrder>();
      const { docketSuggestedCaseNumber: _docketSuggestedCaseNumber, ...existingOrder } =
        (await adapter.findOne(query)) as TransferOrder;
      const { id: _id, orderType: _orderType, caseId: _caseId, ...mutableProperties } = data;
      const updatedOrder = {
        ...existingOrder,
        ...mutableProperties,
      } as TransferOrderAction;
      if (data.status === 'approved') {
        await this.getAdapter<TransferOrderAction>().replaceOne(query, updatedOrder);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createMany(orders: Order[]): Promise<Order[]> {
    try {
      if (!orders.length) return [];
      const adapter = this.getAdapter<Order>();

      const ids = await adapter.insertMany(orders);
      const ordersWithIds = orders.map((order, idx) => {
        return { ...order, id: ids[idx] };
      });
      return ordersWithIds;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
