import { AggregateAuthenticationError } from '@azure/identity';
import { getCosmosConfig, getCosmosDbClient } from '../../../factory';
import { ApplicationContext } from '../../types/basic';
import { CosmosConfig } from '../../types/database';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { isPreExistingDocumentError } from './cosmos.helper';

export interface Item {
  id?: string;
}

export class CosmosDbCrudRepository<T extends Item> {
  protected cosmosDbClient;

  protected containerName: string;
  protected cosmosConfig: CosmosConfig;
  protected moduleName: string;

  constructor(context: ApplicationContext, containerName: string, moduleName: string) {
    this.cosmosDbClient = getCosmosDbClient(context);
    this.cosmosConfig = getCosmosConfig(context);
    this.containerName = containerName;
    this.moduleName = moduleName;
  }

  private async execute<R>(context: ApplicationContext, fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
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

  protected async query(context: ApplicationContext, querySpec: object): Promise<T[]> {
    const lambdaToExecute = async <T>(): Promise<T[]> => {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(querySpec)
        .fetchAll();
      return results;
    };
    return this.execute<T[]>(context, lambdaToExecute);
  }

  public async get(context: ApplicationContext, id: string, partitionKey: string): Promise<T> {
    const lambdaToExecute = async <T>(): Promise<T> => {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
        .read();
      return resource;
    };
    return this.execute<T>(context, lambdaToExecute);
  }

  public async update(context: ApplicationContext, id: string, data: T) {
    const lambdaToExecute = async <T>(): Promise<T> => {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id)
        .replace(data);

      context.logger.debug(this.moduleName, `${typeof data} Updated ${id}`);
      return item;
    };
    return this.execute<T>(context, lambdaToExecute);
  }

  public async put(context: ApplicationContext, data: T): Promise<T> {
    const lambdaToExecute = async <T>(): Promise<T> => {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(data);
      return item;
    };
    return this.execute<T>(context, lambdaToExecute);
  }

  async putAll(context: ApplicationContext, list: T[]): Promise<T[]> {
    const lambdaToExecute = async <T>(): Promise<T[]> => {
      const written: T[] = [];
      if (!list.length) return written;
      for (const record of list) {
        try {
          const { item } = await this.cosmosDbClient
            .database(this.cosmosConfig.databaseName)
            .container(this.containerName)
            .items.create(record);
          written.push(item);
        } catch (e) {
          if (!isPreExistingDocumentError(e)) {
            throw e;
          }
        }
      }
      return written;
    };
    return this.execute<T[]>(context, lambdaToExecute);
  }

  public async delete(context: ApplicationContext, id: string, partitionKey: string) {
    const lambdaToExecute = async <T>(): Promise<T> => {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(id, partitionKey)
        .delete();

      return item;
    };
    return this.execute<T>(context, lambdaToExecute);
  }
}
