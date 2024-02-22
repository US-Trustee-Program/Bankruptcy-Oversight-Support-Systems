import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getOrdersCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ORDERS';
const CONTAINER_NAME: string = 'orders';

export class OrdersCosmosDbRepository implements OrdersRepository {
  private cosmosDbClient;

  private containerName;
  private cosmosConfig: CosmosConfig;
  private moduleName;

  // TODO: allow extending class to override containerName
  constructor(
    context: ApplicationContext,
    containerName: string = CONTAINER_NAME,
    moduleName: string = MODULE_NAME,
  ) {
    this.cosmosDbClient = getOrdersCosmosDbClient(context);
    this.cosmosConfig = getCosmosConfig(context);
    this.containerName = containerName;
    this.moduleName = moduleName;
  }

  async getOrders(context: ApplicationContext): Promise<Order[]> {
    const query = 'SELECT * FROM c ORDER BY c.orderDate ASC';
    const querySpec = {
      query,
      parameters: [],
    };
    const response = await this.queryData<Order>(context, querySpec);
    return response;
  }

  async getOrder(context: ApplicationContext, id: string, partitionKey: string): Promise<Order> {
    try {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
        .read();

      return resource;
    } catch (originalError) {
      context.logger.error(
        this.moduleName,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(this.moduleName, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
  }

  async updateOrder(context: ApplicationContext, id: string, data: TransferOrderAction) {
    try {
      const { resource: existingOrder } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, data.caseId)
        .read();

      if (!existingOrder) {
        throw new NotFoundError(this.moduleName, {
          message: `Order not found with id ${id}`,
        });
      }

      // ONLY gather the mutable properties, however many there are.
      // const { id: _id, ...mutableProperties } = data;
      const { id: _id, ...mutableProperties } = data;

      const updatedOrder = {
        ...existingOrder,
        ...mutableProperties,
      };

      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id)
        .replace(updatedOrder);

      context.logger.debug(this.moduleName, `Order updated ${id}`);
      return { id };
    } catch (originalError) {
      context.logger.error(
        this.moduleName,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(this.moduleName, {
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
          const _result = await this.cosmosDbClient
            .database(this.cosmosConfig.databaseName)
            .container(this.containerName)
            .items.create(order);
          writtenOrders.push(order);
        } catch (e) {
          if (!isPreExistingDocumentError(e)) {
            throw e;
          }
        }
      }
    } catch (originalError) {
      context.logger.error(
        this.moduleName,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(this.moduleName, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
    return writtenOrders;
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
      context.logger.error(
        this.moduleName,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(this.moduleName, {
          message: 'Failed to authenticate to Azure',
          originalError: originalError,
        });
      } else {
        throw originalError;
      }
    }
  }
}
