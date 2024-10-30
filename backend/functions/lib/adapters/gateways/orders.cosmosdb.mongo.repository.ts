import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { ApplicationContext } from '../types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import QueryBuilder, { ConditionOrConjunction } from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'ORDERS_DOCUMENT_REPOSITORY';
const COLLECTION_NAME = 'orders';

const { contains, equals, id, orderBy } = QueryBuilder;

export class OrdersCosmosDbMongoRepository implements OrdersRepository {
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

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: ConditionOrConjunction;
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
      const query = QueryBuilder.build(equals<string>('_id', id));
      const result = await this.getAdapter<Order>().findOne(query);
      return result as Order;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    const query = QueryBuilder.build(id(data.id));
    try {
      const adapter = this.getAdapter<TransferOrder>();
      const { docketSuggestedCaseNumber: _docketSuggestedCaseNumber, ...existingOrder } =
        (await adapter.findOne(query)) as TransferOrder;
      if (!existingOrder) {
        throw new NotFoundError(MODULE_NAME, { message: `Order not found with id ${data.id}` });
      }
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
