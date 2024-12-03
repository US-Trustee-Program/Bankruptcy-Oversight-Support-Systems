import { ApplicationContext } from '../../types/basic';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../../use-cases/gateways.types';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { deferClose } from '../../../deferrable/defer-close';

const MODULE_NAME = 'RUNTIME_STATE_MONGO_REPOSITORY';
const COLLECTION_NAME = 'runtime-state';

const { equals } = QueryBuilder;

export class RuntimeStateMongoRepository<T extends RuntimeState>
  extends BaseMongoRepository
  implements RuntimeStateRepository<T>
{
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    deferClose(context, this.client);
  }

  async read(id: RuntimeStateDocumentType): Promise<T> {
    const query = QueryBuilder.build(equals('documentType', id));
    try {
      const adapter = this.getAdapter<T>();
      return await adapter.findOne(query);
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
