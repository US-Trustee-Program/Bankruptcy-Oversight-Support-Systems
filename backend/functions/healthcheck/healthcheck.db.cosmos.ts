import * as dotenv from 'dotenv';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { DocumentClient } from '../lib/humble-objects/mongo-humble';
import QueryBuilder from '../lib/query/query-builder';
import { toMongoQuery } from '../lib/query/mongo-query-renderer';
import { Closable, deferClose } from '../lib/defer-close';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';

export default class HealthcheckCosmosDb implements Closable {
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private CONTAINER_NAME = 'healthcheck';

  private readonly applicationContext: ApplicationContext;
  private readonly documentClient: DocumentClient;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.applicationContext = applicationContext;
      this.documentClient = new DocumentClient(
        this.applicationContext.config.documentDbConfig.connectionString,
      );
      deferClose(applicationContext, this);
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
      const result = await this.documentClient
        .database(this.databaseName)
        .collection(this.CONTAINER_NAME)
        .find({});

      const items = [];
      for await (const doc of result) {
        items.push(doc);
      }
      return items.length > 0;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbWrite() {
    try {
      const resource = await this.documentClient
        .database(this.databaseName)
        .collection(this.CONTAINER_NAME)
        .insertOne({ id: 'test' });
      this.applicationContext.logger.debug(MODULE_NAME, `New item created ${resource.insertedId}`);
      return resource.acknowledged;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbDelete() {
    const { equals } = QueryBuilder;
    try {
      const result = await this.documentClient
        .database(this.databaseName)
        .collection(this.CONTAINER_NAME)
        .find({});

      const items = [];
      for await (const doc of result) {
        items.push(doc);
      }

      if (items.length > 0) {
        for (const resource of items) {
          this.applicationContext.logger.debug(
            MODULE_NAME,
            `Invoking delete on item ${resource._id}`,
          );

          await this.documentClient
            .database(this.databaseName)
            .collection(this.CONTAINER_NAME)
            .deleteOne(QueryBuilder.build(toMongoQuery, equals('id', resource.id)));
        }
      }
      return true;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  async close() {
    await this.documentClient.close();
  }
}
