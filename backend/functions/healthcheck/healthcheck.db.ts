import { ApplicationContext } from '../lib/adapters/types/basic';
import log from '../lib/adapters/services/logger.service';

import { ManagedIdentityCredential, DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

import * as dotenv from 'dotenv';

dotenv.config();

const NAMESPACE = 'HEALTHCHECK-COSMO-DB';

export default class HealthcheckCosmoDb {
  private readonly dbEndpoint = process.env.COSMOS_ENDPOINT;
  private readonly managedId = process.env.COSMOS_MANAGED_IDENTITY;
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private CONTAINER_NAME = 'healthcheck'; // NOTE: Expect a container named 'healthcheck' with one item

  private readonly ctx: ApplicationContext;
  private readonly cosmoDbClient: CosmosClient;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.ctx = applicationContext;
      this.cosmoDbClient = new CosmosClient({
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

  public async check() {
    try {
      // Check read access
      const { resources: results } = await this.cosmoDbClient
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
}
