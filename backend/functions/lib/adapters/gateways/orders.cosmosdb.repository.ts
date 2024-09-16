import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OrdersRepository } from '../../use-cases/gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';
import { Order, TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import CosmosClientHumble from '../../cosmos-humble-objects/cosmos-client-humble';
import { MockHumbleClient } from '../../testing/mock.cosmos-client-humble';
import { QueryOptions } from '../../cosmos-humble-objects/cosmos-items-humble';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ORDERS';
const CONTAINER_NAME: string = 'orders';

export class OrdersCosmosDbRepository implements OrdersRepository {
  private cosmosDbClient: CosmosClientHumble | MockHumbleClient;

  private containerName;
  private cosmosConfig: CosmosConfig;
  private moduleName;

  constructor(
    context: ApplicationContext,
    containerName: string = CONTAINER_NAME,
    moduleName: string = MODULE_NAME,
  ) {
    this.cosmosDbClient = getCosmosDbClient(context);
    this.cosmosConfig = getCosmosConfig(context);
    this.containerName = containerName;
    this.moduleName = moduleName;
  }

  async search(context: ApplicationContext, predicate?: OrdersSearchPredicate): Promise<Order[]> {
    let querySpec;
    if (!predicate) {
      querySpec = {
        query: 'SELECT * FROM c ORDER BY c.orderDate ASC',
        parameters: [],
      };
    } else {
      // TODO: Sanitize the inputs
      // Group designator comes from local-storage-gateway and is store in the user session cache.
      // We get associated division codes from DXTR and also store that in the session cache.
      // We are not ever trusting the client with this information as of 9 Sept 2024.
      const whereClause =
        'WHERE ' +
        predicate.divisionCodes.map((dCode) => `c.courtDivisionCode='${dCode}'`).join(' OR ') +
        ' ORDER BY c.orderDate ASC';
      querySpec = {
        query: 'SELECT * FROM c ' + whereClause,
        parameters: [],
      };
    }
    const response = await this.queryData<Order>(context, querySpec);
    return response;
  }

  async getOrder(context: ApplicationContext, id: string, partitionKey: string): Promise<Order> {
    try {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
        .read<TransferOrder>();

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
      const partitionKey = data.caseId;
      const { resource: existingOrder } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
        .read<TransferOrder>();

      if (!existingOrder) {
        throw new NotFoundError(this.moduleName, {
          message: `Order not found with id ${id}`,
        });
      }

      // ONLY gather the mutable properties, however many there are.
      // const { id: _id, ...mutableProperties } = data;
      const { id: _id, orderType: _orderType, ...mutableProperties } = data;

      const updatedOrder = {
        ...existingOrder,
        ...mutableProperties,
        docketSuggestedCaseNumber: undefined,
      };

      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
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
            .items.create<Order>(order);
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

  private async queryData<T>(context: ApplicationContext, querySpec: QueryOptions): Promise<T[]> {
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query<T>(querySpec)
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
