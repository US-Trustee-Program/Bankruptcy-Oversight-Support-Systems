import { ApplicationContext } from '../lib/adapters/types/basic';

import * as dotenv from 'dotenv';
import { getAssignmentsCosmosDbClient } from '../lib/factory';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';

export default class HealthcheckCosmosDb {
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private CONTAINER_NAME = 'healthcheck'; // NOTE: Expect a container named 'healthcheck' with one item

  private readonly applicationContext: ApplicationContext;
  private readonly cosmosDbClient;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.applicationContext = applicationContext;
      this.cosmosDbClient = getAssignmentsCosmosDbClient(this.applicationContext);
    } catch (e) {
      applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
  }

  public dbConfig() {
    return {
      databaseName: this.databaseName,
    };
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
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbWrite() {
    try {
      // Check write access
      const { resource } = await this.cosmosDbClient
        .database(this.databaseName)
        .container(this.CONTAINER_NAME)
        .items.create({});
      this.applicationContext.logger.debug(MODULE_NAME, `New item created ${resource.id}`);
      return resource.id != undefined;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
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
        for (const resource of results) {
          this.applicationContext.logger.debug(
            MODULE_NAME,
            `Invoking delete on item ${resource.id}`,
          );

          await this.cosmosDbClient
            .database(this.databaseName)
            .container(this.CONTAINER_NAME)
            .item(resource.id, resource.id)
            .delete();
        }
      }
      return true;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
