import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getOrdersCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import { Order, OrderSyncState } from '../../use-cases/orders/orders.model';

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

  async putOrders(context: ApplicationContext, orders: Order[]) {
    try {
      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(orders);
    } catch (e) {
      log.error(context, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }

  async getSyncState(context: ApplicationContext): Promise<OrderSyncState> {
    const query = 'SELECT * FROM c WHERE documentType = "ORDERS_SYNC_STATE"';
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container('runtime')
        .items.query(query)
        .fetchAll();
      return results[0];
    } catch (e) {
      log.error(context, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }

  async updateSyncState(context: ApplicationContext, syncState: OrderSyncState) {
    try {
      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container('runtime')
        .item(syncState.id)
        .replace(syncState);
    } catch (e) {
      log.error(context, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
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
    } catch (e) {
      log.error(context, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }
}
