import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getRuntimeCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../use-cases/gateways.types';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_RUNTIME_STATE';

export class RuntimeStateCosmosDbRepository implements RuntimeStateRepository {
  private cosmosDbClient;

  private containerName = 'runtime-state';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getRuntimeCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getState<T extends RuntimeState>(
    context: ApplicationContext,
    documentType: RuntimeStateDocumentType,
  ): Promise<T> {
    // TODO: parameterize the documentType
    const query = `SELECT * FROM c WHERE c.documentType = "${documentType}"`;
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(query)
        .fetchAll();

      if (results.length !== 1) {
        throw new CamsError(MODULE_NAME, {
          message: 'Initial state was not found or was ambiguous.',
        });
      }
      return results[0];
    } catch (e) {
      context.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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

  async updateState<T extends RuntimeState>(context: ApplicationContext, syncState: T) {
    try {
      await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(syncState.id)
        .replace(syncState);
    } catch (e) {
      context.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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

  async createState<T extends RuntimeState>(context: ApplicationContext, syncState: T): Promise<T> {
    try {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(syncState);
      return item;
    } catch (e) {
      context.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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
