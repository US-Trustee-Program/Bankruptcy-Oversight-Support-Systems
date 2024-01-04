import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getOrdersCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import { Order, OrderTransfer } from '../../use-cases/orders/orders.model';
import { NotFoundError } from '../../common-errors/not-found-error';

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

      const { newCaseId, newCourtName, newCourtDivisionName, status } = data;
      const updatedOrder = {
        ...existingOrder,
        newCaseId,
        newCourtName,
        newCourtDivisionName,
        status,
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
      // TODO: Revisit batch creation.
      // const operations = orders.map((order) => {
      //   return {
      //     operationType: 'Create',
      //     partitionKey: '/caseId',
      //     resourceBody: order,
      //   };
      // });
      // const results = await this.cosmosDbClient
      //   .database(this.cosmosConfig.databaseName)
      //   .container(this.containerName)
      //   .items.batch(operations);
      for (const order of orders) {
        const _result = await this.cosmosDbClient
          .database(this.cosmosConfig.databaseName)
          .container(this.containerName)
          .items.create(order);

        // TODO: Revisit how we deal with failures. How are we going to recover?
        // if (result.statusCode !== 201) {
        //   throw new CamsError(MODULE_NAME, {
        //     message: 'Failed to create order in Cosmos.',
        //     data: result,
        //   });
        // }
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
