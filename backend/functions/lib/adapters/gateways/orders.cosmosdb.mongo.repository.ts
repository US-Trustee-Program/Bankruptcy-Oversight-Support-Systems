import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';
import { ApplicationContext } from '../types/basic';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { NotFoundError } from '../../common-errors/not-found-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import QueryBuilder from '../../query/query-builder';
import { toMongoQuery } from '../../query/mongo-query-renderer';
import { Closable, deferClose } from '../../defer-close';

const MODULE_NAME = 'ORDERS_DOCUMENT_REPOSITORY';

export class OrdersCosmosDbMongoRepository implements Closable, OrdersRepository {
  private documentClient: DocumentClient;
  private readonly containerName = 'orders';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.documentDbConfig.connectionString);
    deferClose(context, this);
  }

  async search(context: ApplicationContext, predicate: OrdersSearchPredicate): Promise<Order[]> {
    let query: DocumentQuery;
    if (!predicate) {
      query = {};
    } else {
      query = toMongoQuery(QueryBuilder.contains('courtDivisionCode', predicate.divisionCodes));
    }
    console.log(query);
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<Order>(this.containerName);
    const result = (await collection.find(query)).sort({ orderDate: 1 });
    const orders: Order[] = [];

    for await (const doc of result) {
      orders.push(doc);
    }
    return orders;
  }

  async read(context: ApplicationContext, id: string, _unused: string): Promise<Order> {
    const query = toMongoQuery(QueryBuilder.equals('id', id));

    try {
      const collection = this.documentClient
        .database(context.config.documentDbConfig.databaseName)
        .collection<Order>(this.containerName);
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

  async update(context: ApplicationContext, id: string, data: TransferOrderAction) {
    const query = toMongoQuery(QueryBuilder.equals('id', id));
    const collection = this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<TransferOrderAction>(this.containerName);
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

  async createMany(context: ApplicationContext, orders: Order[]): Promise<Order[]> {
    const writtenOrders: Order[] = [];
    if (!orders.length) return writtenOrders;
    try {
      for (const order of orders) {
        try {
          const collection = this.documentClient
            .database(context.config.documentDbConfig.databaseName)
            .collection<Order>(this.containerName);
          const result = await collection.insertOne(order);
          if (result && result.acknowledged) {
            // TODO: add _id: result.insertedId
            writtenOrders.push(order);
          }
        } catch (e) {
          // TODO: insert the same document twice to see what happens
          // Is this error going to be the same through the mongo client? Probably not.
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
    await this.documentClient.close();
  }
}
