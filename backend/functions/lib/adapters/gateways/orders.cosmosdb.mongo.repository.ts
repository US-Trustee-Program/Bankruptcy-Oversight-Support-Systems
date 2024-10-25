import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { ApplicationContext } from '../types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import QueryBuilder, { ConditionOrConjunction } from '../../query/query-builder';
import { Closable, deferClose } from '../../defer-close';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { getCamsError } from '../../common-errors/error-utilities';
import { getDocumentCollectionAdapter } from '../../factory';

const MODULE_NAME = 'ORDERS_DOCUMENT_REPOSITORY';

const { contains, equals } = QueryBuilder;

export class OrdersCosmosDbMongoRepository implements Closable, OrdersRepository {
  private documentClient: DocumentClient;
  private readonly collectionName = 'orders';
  private context: ApplicationContext;
  private dbAdapter: MongoCollectionAdapter<Order>;

  constructor(context: ApplicationContext) {
    const client = new DocumentClient(context.config.documentDbConfig.connectionString);
    this.context = context;
    this.dbAdapter = getDocumentCollectionAdapter<Order>(
      MODULE_NAME,
      client
        .database(context.config.documentDbConfig.connectionString)
        .collection(this.collectionName),
    );
    deferClose(context, this);
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: ConditionOrConjunction;
    if (!predicate) {
      query = null;
    } else {
      query = QueryBuilder.build(contains('courtDivisionCode', predicate.divisionCodes));
    }
    const result = await this.dbAdapter.find(query);
    //TODO: how do we want to handle sorting now that we have an adapter?
    // const result = (await collection.find(query)).sort({ orderDate: 1 });
    const orders: Order[] = [];

    for await (const doc of result) {
      orders.push(doc);
    }
    return orders;
  }

  async read(id: string, _unused: string): Promise<Order> {
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
    const writtenOrders: Order[] = [];
    if (!orders.length) return writtenOrders;
    try {
      for (const order of orders) {
        try {
          const writtenId = await this.dbAdapter.insertOne(order);
          const tempOrder = { ...order, id: writtenId };
          writtenOrders.push(tempOrder);
        } catch (e) {
          // TODO: insert the same document twice to see what happens
          // Is this error going to be the same through the mongo client? Probably not.
          // if (!isPreExistingDocumentError(e)) {
          //   throw e;
          // }
        }
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
    return writtenOrders;
  }

  async close() {
    await this.documentClient.close();
  }
}
