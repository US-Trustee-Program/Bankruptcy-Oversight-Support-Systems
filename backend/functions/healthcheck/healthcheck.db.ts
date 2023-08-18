import { ApplicationContext } from '../lib/adapters/types/basic';
import log from '../lib/adapters/services/logger.service';

import { ManagedIdentityCredential, DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

import * as dotenv from 'dotenv';

dotenv.config();

const NAMESPACE = 'HEALTHCHECK-COSMOS-DB';

export default class HealthcheckCosmosDb {
  private readonly dbEndpoint = process.env.COSMOS_ENDPOINT;
  private readonly managedId = process.env.COSMOS_MANAGED_IDENTITY;
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private CONTAINER_NAME = 'healthcheck'; // NOTE: Expect a container named 'healthcheck' with one item

  private readonly ctx: ApplicationContext;
  private readonly cosmosDbClient: CosmosClient;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.ctx = applicationContext;
      this.cosmosDbClient = new CosmosClient({
        endpoint: this.dbEndpoint,
        aadCredentials: this.managedId
          ? new ManagedIdentityCredential({
              clientId: this.managedId,
            })
          : new DefaultAzureCredential(),
      });
    } catch (e) {
      log.error(this.ctx, NAMESPACE, `${e.name}: ${e.message}`);
    }
  }

  public async checkDbRead() {
    try {
      // Check read access
      const { resources: results } = await this.cosmosDbClient
        .database(this.databaseName)
        .container(this.CONTAINER_NAME)
        .items.readAll()
        .fetchAll();
      return results.length > 0;
    } catch (e) {
      log.error(this.ctx, NAMESPACE, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbWrite() {
    try {
      // Check write access
      const { item: item } = await this.cosmosDbClient
        .database(this.databaseName)
        .container(this.CONTAINER_NAME)
        .items.create({});
      log.debug(this.ctx, NAMESPACE, `New item created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.ctx, NAMESPACE, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbDelete() {
    try {
      // Check read access
      const { resources: results } = await this.cosmosDbClient
        .database(this.databaseName)
        .container(this.CONTAINER_NAME)
        .items.readAll()
        .fetchAll();

      if (results.length > 0) {
        for (const item of results) {
          log.debug(this.ctx, NAMESPACE, `Invoking delete on item ${item.id}`);

          await this.cosmosDbClient
            .database(this.databaseName)
            .container(this.CONTAINER_NAME)
            .item(item.id, item.id)
            .delete();
        }
      }
      return true;
    } catch (e) {
      log.error(this.ctx, NAMESPACE, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
