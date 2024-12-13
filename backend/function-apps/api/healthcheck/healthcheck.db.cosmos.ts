import * as dotenv from 'dotenv';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { DocumentClient } from '../../../lib/humble-objects/mongo-humble';
import QueryBuilder from '../../../lib/query/query-builder';
import { deferClose } from '../../../lib/deferrable/defer-close';
import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';
const COLLECTION_NAME = 'healthcheck';

export type HealthCheckDocument = {
  id?: string;
  healthCheckId: string;
  documentType: 'HEALTH_CHECK';
};

export default class HealthcheckCosmosDb {
  private readonly client: DocumentClient;
  private readonly databaseName: string;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    const { connectionString, databaseName } = this.context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString, context);
    deferClose(this.client, context);
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

  public async checkDocumentDb() {
    const status = {
      cosmosDbWriteStatus: false,
      cosmosDbReadStatus: undefined,
      cosmosDbDeleteStatus: undefined,
    };

    status.cosmosDbWriteStatus = await this.checkDbWrite();
    status.cosmosDbReadStatus = await this.checkDbRead();
    status.cosmosDbDeleteStatus = await this.checkDbDelete();

    return status;
  }

  private async checkDbRead() {
    try {
      const items = await this.getAdapter<HealthCheckDocument>().getAll();

      return items.length > 0;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  private async checkDbWrite() {
    const healthCheckDocument: HealthCheckDocument = {
      healthCheckId: 'arbitrary-id',
      documentType: 'HEALTH_CHECK',
    };
    try {
      await this.getAdapter<HealthCheckDocument>().insertOne(healthCheckDocument);
      return true;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }

  private async checkDbDelete() {
    const { equals } = QueryBuilder;
    try {
      const items = await this.getAdapter<HealthCheckDocument>().getAll();

      if (items.length > 0) {
        for (const resource of items) {
          this.context.logger.debug(MODULE_NAME, `Invoking delete on item ${resource.id}`);

          await this.getAdapter().deleteOne(
            QueryBuilder.build(
              equals<HealthCheckDocument['healthCheckId']>('healthCheckId', resource.healthCheckId),
            ),
          );
        }
        return true;
      }
    } catch (e) {
      this.context.logger.error(MODULE_NAME, `${e.name}: ${e.message}`);
    }
    return false;
  }
}
