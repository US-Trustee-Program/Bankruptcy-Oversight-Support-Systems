import { DocumentClient } from '../../../../humble-objects/mongo-humble';
import { ApplicationContext } from '../../../types/basic';
import { MongoCollectionAdapter } from './mongo-adapter';

export abstract class BaseMongoRepository {
  protected readonly client: DocumentClient;
  protected readonly collectionName: string;
  protected readonly databaseName: string;
  protected readonly moduleName: string = '';

  protected constructor(context: ApplicationContext, moduleName: string, collectionName: string) {
    this.moduleName = moduleName;
    this.collectionName = collectionName;
    const { connectionString, databaseName } = context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
  }

  protected getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      this.moduleName,
      this.collectionName,
      this.databaseName,
      this.client,
    );
  }
}
