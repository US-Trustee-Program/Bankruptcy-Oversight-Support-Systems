import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';
import { ApplicationContext } from '../types/basic';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'ORDERS_DOCUMENT_REPOSITORY';

export class OrdersCosmosDbMongoRepository {
  private client: DocumentClient;

  constructor(connectionString: string) {
    this.client = new DocumentClient(connectionString);
  }

  async search(predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: DocumentQuery;
    if (!predicate) {
      query = {};
    } else {
      query = { courtDivisionCode: { contains: predicate.divisionCodes } };
    }
    const collection = this.client.database('cams').collection<Order>('orders');
    const result = (await collection.find(query)).sort({ orderDate: 1 });
    const orders: Order[] = [];

    for await (const doc of result) {
      orders.push(doc);
    }
    return orders;
  }

  async getOrder(context: ApplicationContext, id: string): Promise<Order> {
    //partitionKey, do we still need this for unique itendifiers?
    const query: DocumentQuery = {
      id: { equals: id },
    };
    try {
      const collection = this.client.database('cams').collection<Order>('orders');
      const result = await collection.findOne(query);
      return result;
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
  }

  async updateOrder(context: ApplicationContext, id: string, data: TransferOrderAction) {
    const query: DocumentQuery = {
      id: { equals: id },
    };
    const collection = this.client.database('cams').collection<TransferOrderAction>('orders');
    try {
      const existingOrder = await collection.findOne(query);
      if (!existingOrder) {
        throw new NotFoundError(MODULE_NAME, { message: `Order not found with id ${id}` });
      }
      const { id: _id, orderType: _orderType, caseId: _caseId, ...mutableProperties } = data;
      const updatedOrder = {
        ...existingOrder,
        ...mutableProperties,
        docketSuggestedCaseNumber: undefined,
      };
      const result = await collection.replaceOne(query, updatedOrder);
      context.logger.debug(MODULE_NAME, `Order updated ${id}, ${result}`);

      return { id };
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
  }

  async putOrders(context: ApplicationContext, orders: Order[]): Promise<Order[]> {
    const writtenOrders: Order[] = [];
    if (!orders.length) return writtenOrders;
    try {
      for (const order of orders) {
        try {
          const collection = this.client.database('cams').collection<Order>('orders');
          const result = await collection.insertOne(order);
          if (result) writtenOrders.push(order);
        } catch (e) {
          // TODO: insert the same document twice to see what happens
          // if (!isPreExistingDocumentError(e)) {
          //   throw e;
          // }
        }
      }
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
    return writtenOrders;
  }

  async close() {
    this.client.close();
  }
}
