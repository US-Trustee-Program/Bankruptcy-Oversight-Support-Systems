import { ApplicationContext } from '../../../use-cases/application.types';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../../use-cases/gateways.types';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'RUNTIME-STATE-MONGO-REPOSITORY';
const COLLECTION_NAME = 'runtime-state';

const doc = QueryBuilder.using<RuntimeState>();

export class RuntimeStateMongoRepository<T extends RuntimeState>
  extends BaseMongoRepository
  implements RuntimeStateRepository<T>
{
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  async read(id: RuntimeStateDocumentType): Promise<T> {
    const query = doc('documentType').equals(id);
    try {
      const adapter = this.getAdapter<T>();
      return await adapter.findOne(query);
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }

  async upsert(data: T): Promise<T> {
    try {
      const query = doc('documentType').equals(data.documentType);
      const adapter = this.getAdapter<T>();
      const result = await adapter.replaceOne(query, data, true);
      if (result.modifiedCount + result.upsertedCount > 0) {
        return { ...data, id: result.id } as T;
      }
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }
}
