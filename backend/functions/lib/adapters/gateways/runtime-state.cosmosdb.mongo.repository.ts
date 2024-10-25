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
  private dbAdapter: MongoCollectionAdapter<T>;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    const client = new DocumentClient(connectionString);
    this.dbAdapter = new MongoCollectionAdapter<T>(
      MODULE_NAME,
      client.database(databaseName).collection(COLLECTION_NAME),
    );
    deferClose(context, client);
  }

  async read(id: RuntimeStateDocumentType): Promise<T> {
    const query = QueryBuilder.build(equals('documentType', id));
    try {
      const state = await this.dbAdapter.find(query);
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

  async upsert(data: RuntimeState): Promise<T> {
    try {
      const query = QueryBuilder.build(equals('documentType', data.documentType));
      const id = await this.dbAdapter.replaceOne(query, data, true);
      return { ...data, id } as T;
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }
}
