import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { ApplicationContext } from '../types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import QueryBuilder, { ConditionOrConjunction } from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { getCamsError } from '../../common-errors/error-utilities';
import { getDocumentCollectionAdapter } from '../../factory';

const MODULE_NAME = 'ORDERS_DOCUMENT_REPOSITORY';
const COLLECTION_NAME = 'orders';

const { contains, equals, orderBy } = QueryBuilder;

export class OrdersCosmosDbMongoRepository implements OrdersRepository {
  private dbAdapter: MongoCollectionAdapter<Order>;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;

    const client = new DocumentClient(connectionString);
    this.dbAdapter = getDocumentCollectionAdapter<Order>(
      MODULE_NAME,
      client.database(databaseName).collection(COLLECTION_NAME),
    );
    deferClose(context, client);
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: ConditionOrConjunction;
    if (!predicate) {
      query = null;
    } else {
      query = QueryBuilder.build(contains('courtDivisionCode', predicate.divisionCodes));
    }

    try {
      return await this.dbAdapter.find(query, orderBy(['orderDate', 'ASCENDING']));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async read(id: string): Promise<Order> {
    try {
      const query = QueryBuilder.build(equals<string>('_id', id));
      const result = await this.dbAdapter.findOne(query);
      return result as Order;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async update(data: TransferOrderAction) {
    const query = QueryBuilder.build(equals('id', data.id));
    try {
      const existingOrder = await this.dbAdapter.findOne(query);
      if (!existingOrder) {
        throw new NotFoundError(MODULE_NAME, { message: `Order not found with id ${data.id}` });
      }
      const { id: _id, orderType: _orderType, caseId: _caseId, ...mutableProperties } = data;
      const updatedOrder = {
        ...(existingOrder as unknown as Order),
        ...mutableProperties,
        docketSuggestedCaseNumber: undefined,
      };
      await this.dbAdapter.replaceOne(query, updatedOrder);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createMany(orders: Order[]): Promise<Order[]> {
    try {
      if (!orders.length) return [];

      const ids = await this.dbAdapter.insertMany(orders);
      const ordersWithIds = orders.map((order, idx) => {
        return { ...order, id: ids[idx] };
      });
      return ordersWithIds;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
