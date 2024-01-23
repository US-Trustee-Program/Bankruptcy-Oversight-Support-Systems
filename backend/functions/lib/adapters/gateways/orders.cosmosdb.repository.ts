import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getOrdersCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import { Order, OrderTransfer } from '../../use-cases/orders/orders.model';
import { NotFoundError } from '../../common-errors/not-found-error';
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ORDERS';

export class OrdersCosmosDbRepository implements OrdersRepository {
  private cosmosDbClient;

  private containerName = 'orders';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getOrdersCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getOrders(context: ApplicationContext): Promise<Order[]> {
    const query = 'SELECT * FROM c';
    const querySpec = {
      query,
      parameters: [],
    };
    const response = await this.queryData<Order>(context, querySpec);
    return response;
  }

  async getOrder(context: ApplicationContext, id: string, caseId: string): Promise<Order> {
    try {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, caseId)
        .read();

      return resource;
    } catch (originalError) {
      log.error(
        context,
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

  async updateOrder(context: ApplicationContext, id: string, data: OrderTransfer) {
    try {
      const { resource: existingOrder } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, data.caseId)
        .read();

      if (!existingOrder) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Order not found with id ${id}`,
        });
      }

      // ONLY gather the mutable properties, however many there are.
      const { id: _id, sequenceNumber: _sn, caseId: _cid, ...mutableProperties } = data;

      const updatedOrder = {
        ...existingOrder,
        ...mutableProperties,
      };

      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id)
        .replace(updatedOrder);

      log.debug(context, MODULE_NAME, `Order updated ${id}`);
      return { id };
    } catch (originalError) {
      log.error(
        context,
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

  async putOrders(context: ApplicationContext, orders: Order[]) {
    if (!orders.length) return;
    try {
      for (const order of orders) {
        order.id = order.caseId + '_' + order.sequenceNumber;
        try {
          const _result = await this.cosmosDbClient
            .database(this.cosmosConfig.databaseName)
            .container(this.containerName)
            .items.create(order);
        } catch (e) {
          if (!isPreExistingDocumentError(e)) {
            throw e;
          }
        }
      }
    } catch (originalError) {
      log.error(
        context,
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

  private async queryData<T>(context: ApplicationContext, querySpec: object): Promise<T[]> {
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(querySpec)
        .fetchAll();
      return results;
    } catch (originalError) {
      log.error(
        context,
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: originalError,
        });
      } else {
        throw originalError;
      }
    }
  }
}
