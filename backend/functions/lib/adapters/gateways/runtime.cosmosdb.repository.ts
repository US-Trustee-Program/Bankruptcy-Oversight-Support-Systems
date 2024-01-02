import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import {
  RuntimeRepository,
  SyncState,
  SyncStateDocumentType,
} from '../../use-cases/gateways.types';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_RUNTIME';

export class RuntimeCosmosDbRepository implements RuntimeRepository {
  private cosmosDbClient;

  private containerName = 'runtime';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getSyncState<T extends SyncState>(
    context: ApplicationContext,
    documentType: SyncStateDocumentType,
  ): Promise<T> {
    // TODO: parameterize the documentType
    const query = `SELECT * FROM c WHERE documentType = "${documentType}"`;
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(query)
        .fetchAll();
      // TODO: Need to check for ONE record. Error if 0 or >1.
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

  async updateSyncState<T extends SyncState>(context: ApplicationContext, syncState: T) {
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
}
