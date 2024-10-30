import { ApplicationContext } from '../types/basic';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../use-cases/gateways.types';
import { CamsError } from '../../common-errors/cams-error';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { deferClose } from '../../defer-close';
import QueryBuilder from '../../query/query-builder';
import { getCamsError } from '../../common-errors/error-utilities';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';

const MODULE_NAME = 'COSMOS_DB_REPOSITORY_RUNTIME_STATE';
const COLLECTION_NAME = 'runtime-state';

const { equals } = QueryBuilder;

export class RuntimeStateCosmosMongoDbRepository<T extends RuntimeState>
  implements RuntimeStateRepository<T>
{
  private readonly client: DocumentClient;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
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

  async read(id: RuntimeStateDocumentType): Promise<T> {
    const query = QueryBuilder.build(equals('documentType', id));
    try {
      const adapter = this.getAdapter<T>();
      const state = await adapter.find(query);
      if (state.length !== 1) {
        throw new CamsError(MODULE_NAME, {
          message: 'Initial state was not found or was ambiguous.',
        });
      }
      return state[0];
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }

  async upsert(data: T): Promise<T> {
    try {
      const query = QueryBuilder.build(equals('documentType', data.documentType));
      const adapter = this.getAdapter<T>();
      const id = await adapter.replaceOne(query, data, true);
      return { ...data, id } as T;
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }
}
