import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder, { Query } from '../../../query/query-builder';
import { OrdersRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ORDERS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'orders';

const { orderBy, using } = QueryBuilder;

export class OrdersMongoRepository extends BaseMongoRepository implements OrdersRepository {
  private static instance: OrdersMongoRepository;
  private static referenceCount: number = 0;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
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

  public static getInstance(context: ApplicationContext) {
    if (!OrdersMongoRepository.instance) {
      OrdersMongoRepository.instance = new OrdersMongoRepository(context);
    }
    OrdersMongoRepository.referenceCount++;
    return OrdersMongoRepository.instance;
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

  async read(id: string): Promise<Order> {
    try {
      const doc = using<Order>();
      const query = doc('id').equals(id);
      return await this.getAdapter<Order>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public release() {
    OrdersMongoRepository.dropInstance();
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    try {
      const doc = using<Order>();
      const query: Query<Order> = predicate
        ? doc('courtDivisionCode').contains(predicate.divisionCodes)
        : null;
      return await this.getAdapter<Order>().find(query, orderBy<Order>(['orderDate', 'ASCENDING']));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    try {
      const existingQuery = using<TransferOrder>()('id').equals(data.id);

      const adapter = this.getAdapter<TransferOrder>();
      const foundOrder = await adapter.findOne(existingQuery);

      const { docketSuggestedCaseNumber: _ignore, ...existingOrder } = foundOrder;
      const { caseId: _caseId, id: _id, orderType: _orderType, ...mutableProperties } = data;

      const updatedOrder: TransferOrderAction = {
        ...existingOrder,
        ...mutableProperties,
      };

      const replacementQuery = using<TransferOrderAction>()('id').equals(data.id);

      if (data.status === 'approved') {
        await this.getAdapter<TransferOrderAction>().replaceOne(replacementQuery, updatedOrder);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
