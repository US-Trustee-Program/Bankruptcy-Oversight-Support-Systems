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

  /**
   * Deletes the single runtime-state document for this documentType, if one exists - used by a
   * dataflow's own "purge" intent (e.g. sync-acms-professional-ids.ts's full-reset backfill) to
   * genuinely remove stale progress rather than merely bypass reading it. Uses deleteMany rather
   * than the adapter's deleteOne so a purge run against a documentType with no persisted state
   * yet (first run ever, or already deleted by a prior purge) is a harmless no-op instead of a
   * thrown NotFoundError - deleteOne's own contract treats "nothing matched" as an error, which is
   * the wrong semantic for an idempotent purge.
   */
  async delete(id: RuntimeStateDocumentType): Promise<void> {
    try {
      const adapter = this.getAdapter<T>();
      const query = doc('documentType').equals(id);
      await adapter.deleteMany(query);
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

  async setField(
    documentType: RuntimeStateDocumentType,
    path: string,
    value: unknown,
  ): Promise<void> {
    try {
      const adapter = this.getAdapter<T>();
      const query = doc('documentType').equals(documentType);
      await adapter.findOneAndUpdate(
        query,
        { $set: { [path]: value }, $setOnInsert: { documentType } },
        { upsert: true },
      );
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

      // State document is guaranteed to exist with all counter fields initialized
      // to 0 by the fresh-start fence write before any PAGE messages fire.
      const result = await adapter.findOneAndUpdate(
        query,
        { $inc: { [field]: amount } },
        { returnDocument: 'after' },
      );
      if (!result) {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicIncrement: document not found for ${documentType}. Was state initialized?`,
        });
      }
      const value = result[field];
      if (typeof value !== 'number') {
        throw new UnknownError(MODULE_NAME, {
          message: `atomicIncrement: field '${field}' is not a number in ${documentType}. Value: ${JSON.stringify(value)}`,
        });
      }
      return value;
    } catch (e) {
      throw getCamsError(e, MODULE_NAME);
    }
  }
}
