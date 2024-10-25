import * as dotenv from 'dotenv';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { DocumentClient } from '../lib/humble-objects/mongo-humble';
import QueryBuilder from '../lib/query/query-builder';
import { deferClose } from '../lib/defer-close';
import { MongoCollectionAdapter } from '../lib/adapters/gateways/mongo/mongo-adapter';
import { CamsDocument } from '../../../common/src/cams/document';
import { getDocumentCollectionAdapter } from '../lib/factory';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';
const CONTAINER_NAME = 'healthcheck';

export default class HealthcheckCosmosDb {
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;
  private readonly adapter: MongoCollectionAdapter<CamsDocument>;

  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    try {
      this.applicationContext = applicationContext;
      const client = new DocumentClient(
        this.applicationContext.config.documentDbConfig.connectionString,
      );
      this.adapter = getDocumentCollectionAdapter<CamsDocument>(
        MODULE_NAME,
        client.database(this.databaseName).collection(CONTAINER_NAME),
      );
      deferClose(applicationContext, client);
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
      const result = await this.adapter.find(null);

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
      const resource = await this.adapter.insertOne({ id: 'test' });
      this.applicationContext.logger.debug(MODULE_NAME, `New item created ${resource}`);
      return !!resource;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  public async checkDbDelete() {
    const { equals } = QueryBuilder;
    try {
      const result = await this.adapter.find(null);

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

          await this.adapter.deleteOne(QueryBuilder.build(equals('id', resource.id)));
        }
      }
      return true;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
