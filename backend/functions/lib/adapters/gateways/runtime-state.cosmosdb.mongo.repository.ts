import { ApplicationContext } from '../types/basic';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../use-cases/gateways.types';
import { CamsError } from '../../common-errors/cams-error';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { Closable, deferClose } from '../../defer-close';
import QueryBuilder from '../../query/query-builder';
import { toMongoQuery } from '../../query/mongo-query-renderer';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_RUNTIME_STATE';
const { equals } = QueryBuilder;

export class RuntimeStateCosmosMongoDbRepository implements RuntimeStateRepository, Closable {
  private documentClient: DocumentClient;
  private context: ApplicationContext;
  private readonly collectionName = 'runtime-state';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.documentDbConfig.connectionString);
    this.context = context;
    deferClose(context, this);
  }

  async read<T extends RuntimeState>(
    _context: ApplicationContext,
    id: RuntimeStateDocumentType,
  ): Promise<T> {
    // TODO: parameterize the documentType
    const query = QueryBuilder.build(toMongoQuery, equals('documentType', id));
    const state = [];
    try {
      const result = await this.documentClient
        .database(this.context.config.documentDbConfig.databaseName)
        .collection(this.collectionName)
        .find(query);
      for await (const doc of result) {
        state.push(doc);
      }
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

  async update<T extends RuntimeState>(
    _context: ApplicationContext,
    _id: string | undefined,
    data: T,
  ): Promise<void> {
    const query = QueryBuilder.build(toMongoQuery, equals('documentType', data.documentType));
    try {
      await this.documentClient
        .database(this.context.config.documentDbConfig.databaseName)
        .collection(this.collectionName)
        .replaceOne(query, data);
    } catch (e) {
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }

  async create(_context: ApplicationContext, data: RuntimeState): Promise<string> {
    try {
      const result = await this.documentClient
        .database(this.context.config.documentDbConfig.databaseName)
        .collection(this.collectionName)
        .insertOne(data);
      return result.insertedId.toString();
    } catch (e) {
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }

  async close() {
    await this.documentClient.close();
  }
}
