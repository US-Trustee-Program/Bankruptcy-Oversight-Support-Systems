import * as dotenv from 'dotenv';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { DocumentClient } from '../lib/humble-objects/mongo-humble';
import QueryBuilder from '../lib/query/query-builder';
import { deferClose } from '../lib/defer-close';
import { MongoCollectionAdapter } from '../lib/adapters/gateways/mongo/mongo-adapter';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';
const COLLECTION_NAME = 'healthcheck';

type HealthCheckDocument = {
  id: string;
  healtchCheckId: string;
};

export default class HealthcheckCosmosDb {
  private readonly client: DocumentClient;
  private readonly databaseName: string;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    const { connectionString, databaseName } = this.context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(context, this.client);
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }
  public dbConfig() {
    return {
      databaseName: this.databaseName,
    };
  }

  public async checkDbRead() {
    try {
      const result = await this.getAdapter().find(null);

      const items = [];
      for await (const doc of result) {
        items.push(doc);
      }
      return items.length > 0;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbWrite() {
    const healthCheckDocument: HealthCheckDocument = {
      id: 'test-id',
      healtchCheckId: 'arbitrary-id',
    };
    try {
      const resource = await this.getAdapter<HealthCheckDocument>().insertOne(healthCheckDocument);
      this.context.logger.debug(MODULE_NAME, `New item created ${resource}`);
      return !!resource;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbDelete() {
    const { id } = QueryBuilder;
    try {
      const result = await this.getAdapter().find(null);

      const items = [];
      for await (const doc of result) {
        items.push(doc);
      }

      if (items.length > 0) {
        for (const resource of items) {
          this.context.logger.debug(MODULE_NAME, `Invoking delete on item ${resource.id}`);

          await this.getAdapter().deleteOne(QueryBuilder.build(id(resource.id)));
        }
      }
      return true;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
