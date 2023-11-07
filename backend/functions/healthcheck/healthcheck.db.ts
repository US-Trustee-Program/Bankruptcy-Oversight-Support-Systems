import { ApplicationContext } from '../lib/adapters/types/basic';
import log from '../lib/adapters/services/logger.service';

import * as dotenv from 'dotenv';
import { getCosmosDbClient } from '../lib/factory';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';

export default class HealthcheckCosmosDb {
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private CONTAINER_NAME = 'healthcheck'; // NOTE: Expect a container named 'healthcheck' with one item

  private readonly ctx: ApplicationContext;
  private readonly cosmosDbClient;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.ctx = applicationContext;
      this.cosmosDbClient = getCosmosDbClient(this.ctx);
    } catch (e) {
      log.error(this.ctx, MODULE_NAME, `${e.name}: ${e.message}`);
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
      log.error(this.ctx, MODULE_NAME, `${e.name}: ${e.message}`);
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
      log.debug(this.ctx, MODULE_NAME, `New item created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.ctx, MODULE_NAME, `${e.name}: ${e.message}`);
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
          log.debug(this.ctx, MODULE_NAME, `Invoking delete on item ${item.id}`);

          await this.cosmosDbClient
            .database(this.databaseName)
            .container(this.CONTAINER_NAME)
            .item(item.id, item.id)
            .delete();
        }
      }
      return true;
    } catch (e) {
      log.error(this.ctx, MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
