import * as dotenv from 'dotenv';

import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { deferClose } from '../../../lib/deferrable/defer-close';
import { DocumentClient } from '../../../lib/humble-objects/mongo-humble';
import QueryBuilder from '../../../lib/query/query-builder';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-COSMOS-DB';
const COLLECTION_NAME = 'healthcheck';

export type HealthCheckDocument = {
  documentType: 'HEALTH_CHECK';
  healthCheckId: string;
  id?: string;
};

export default class HealthcheckCosmosDb {
  private readonly client: DocumentClient;
  private readonly context: ApplicationContext;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    this.context = context;
    const { connectionString, databaseName } = this.context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(this.client, context);
  }

  public async checkDocumentDb() {
    const status = {
      cosmosDbDeleteStatus: undefined,
      cosmosDbReadStatus: undefined,
      cosmosDbWriteStatus: false,
    };

    status.cosmosDbWriteStatus = await this.checkDbWrite();
    status.cosmosDbReadStatus = await this.checkDbRead();
    status.cosmosDbDeleteStatus = await this.checkDbDelete();

    return status;
  }

  public dbConfig() {
    return {
      databaseName: this.databaseName,
    };
  }

  private async checkDbDelete() {
    const doc = QueryBuilder.using<HealthCheckDocument>();
    try {
      const items = await this.getAdapter<HealthCheckDocument>().getAll();

      if (items.length > 0) {
        for (const resource of items) {
          this.context.logger.debug(MODULE_NAME, `Invoking delete on item ${resource.id}`);

          await this.getAdapter<HealthCheckDocument>().deleteOne(
            doc('healthCheckId').equals(resource.healthCheckId),
          );
        }
        return true;
      }
    } catch (e) {
      this.context.logger.error(MODULE_NAME, 'Failed db delete check.', e);
    }
    return false;
  }

  private async checkDbRead() {
    try {
      const items = await this.getAdapter<HealthCheckDocument>().getAll();

      return items.length > 0;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, 'Failed db read check.', e);
    }
    return false;
  }

  private async checkDbWrite() {
    const healthCheckDocument: HealthCheckDocument = {
      documentType: 'HEALTH_CHECK',
      healthCheckId: 'arbitrary-id',
    };
    try {
      await this.getAdapter<HealthCheckDocument>().insertOne(healthCheckDocument);
      return true;
    } catch (e) {
      this.context.logger.error(MODULE_NAME, 'Failed db write check.', e);
    }
    return false;
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }
}
