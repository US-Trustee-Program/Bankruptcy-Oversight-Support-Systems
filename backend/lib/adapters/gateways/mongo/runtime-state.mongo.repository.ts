import { ApplicationContext } from '../../types/basic';
import {
  RuntimeStateRepository,
  RuntimeState,
  RuntimeStateDocumentType,
} from '../../../use-cases/gateways.types';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { UnknownError } from '../../../common-errors/unknown-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { randomUUID } from 'crypto';

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

  async atomicDecrement(
    documentType: RuntimeStateDocumentType,
    field: keyof T & string,
    initialValue: number,
  ): Promise<number> {
    try {
      const adapter = this.getAdapter<T>();
      const query = doc('documentType').equals(documentType);

      // Seed the counter on first use. Mongo rejects $inc and $setOnInsert on
      // the same path in one update, so we seed in a separate upsert and then
      // do the atomic $inc. Both round-trips are race-safe at the document
      // level; a concurrent caller either finds the seeded doc or seeds it
      // itself, and the subsequent $inc is always atomic.
      await adapter.findOneAndUpdate(
        query,
        {
          $set: { documentType },
          $setOnInsert: { [field]: initialValue, id: randomUUID() },
        },
        { upsert: true },
      );

      const result = await adapter.findOneAndUpdate(
        query,
        { $inc: { [field]: -1 } },
        { returnDocument: 'after' },
      );
      if (!result) {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicDecrement returned no document for ${documentType}.`,
        });
      }
      const value = result[field];
      if (typeof value !== 'number') {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicDecrement: field '${field}' is not a number in ${documentType}.`,
        });
      }
      return value;
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }

  async atomicIncrement(
    documentType: RuntimeStateDocumentType,
    field: keyof T & string,
    amount: number = 1,
  ): Promise<number> {
    try {
      const adapter = this.getAdapter<T>();
      const query = doc('documentType').equals(documentType);

      // The migration state document is guaranteed to have all counter fields
      // initialized as numbers (not null/missing) by updateMigrationState.
      // A single atomic $inc is sufficient — no seed step needed.
      const result = await adapter.findOneAndUpdate(
        query,
        { $inc: { [field]: amount } },
        { returnDocument: 'after' },
      );
      if (!result) {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicIncrement returned no document for ${documentType}.`,
        });
      }
      const value = result[field];
      if (typeof value !== 'number') {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicIncrement: field '${field}' is not a number in ${documentType}.`,
        });
      }
      return value;
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }
}
