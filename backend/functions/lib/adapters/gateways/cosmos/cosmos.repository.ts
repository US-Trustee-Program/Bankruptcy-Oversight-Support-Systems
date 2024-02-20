import { AggregateAuthenticationError } from '@azure/identity';
import { getCosmosConfig, getOrdersCosmosDbClient } from '../../../factory';
import { ApplicationContext } from '../../types/basic';
import { CosmosConfig } from '../../types/database';
import { ServerConfigError } from '../../../common-errors/server-config-error';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY';

export class CosmosDbCrudRepository<T> {
  protected cosmosDbClient;

  protected containerName;
  protected cosmosConfig: CosmosConfig;
  protected moduleName;

  // TODO: allow extending class to override containerName
  constructor(
    context: ApplicationContext,
    containerName: string,
    moduleName: string = MODULE_NAME,
  ) {
    this.cosmosDbClient = getOrdersCosmosDbClient(context);
    this.cosmosConfig = getCosmosConfig(context);
    this.containerName = containerName;
    this.moduleName = moduleName;
  }

  public async get(context: ApplicationContext, id: string, partitionKey: string): Promise<T> {
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

  public async update(context: ApplicationContext, id: string, data: T) {
    try {
      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id)
        .replace(data);

      context.logger.debug(this.moduleName, `${typeof data} Updated ${id}`);
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

  public async put(context: ApplicationContext, data: T): Promise<T> {
    try {
      const _result = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(data);
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
    return data;
  }

  protected async query(context: ApplicationContext, querySpec: object): Promise<T[]> {
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
