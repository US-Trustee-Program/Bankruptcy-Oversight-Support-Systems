import { NotFoundError } from '../../../common-errors/not-found-error';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsError } from '../../../common-errors/cams-error';
import { ConditionOrConjunction } from '../../../query/query-builder';
import { toMongoQuery } from '../../../query/mongo-query-renderer';

export class MongoCollectionAdapter<T> {
  private collectionHumble: CollectionHumble<T>;
  private readonly notAcknowledged: UnknownError;
  private readonly moduleName: string;

  private testAcknowledged(result: { acknowledged?: boolean }) {
    if (result.acknowledged === false) {
      throw this.notAcknowledged;
    }
  }

  constructor(moduleName: string, collection: CollectionHumble<T>) {
    this.collectionHumble = collection;
    this.moduleName = moduleName;
    this.notAcknowledged = new UnknownError(this.moduleName, {
      message: 'Operation returned Not Acknowledged.',
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async find(query: ConditionOrConjunction | null, sort?: any): Promise<T[]> {
    const mongoQuery = query ? toMongoQuery(query) : {};
    try {
      let results;
      if (sort) {
        results = (await this.collectionHumble.find(mongoQuery)).sort(sort);
      } else {
        results = await this.collectionHumble.find(mongoQuery);
      }
      const items: T[] = [];
      for await (const doc of results) {
        items.push(doc as T);
      }
      return items;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async findOne(query: ConditionOrConjunction): Promise<T> {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.findOne<T>(mongoQuery);
      if (!result) {
        throw new NotFoundError(this.moduleName, { message: 'No matching item found.' });
      }
      return result;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async replaceOne(query: ConditionOrConjunction, item: unknown, upsert: boolean = false) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.replaceOne(mongoQuery, item, upsert);
      this.testAcknowledged(result);

      return result.upsertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertOne(item: unknown) {
    try {
      const result = await this.collectionHumble.insertOne(item);
      this.testAcknowledged(result);

      return result.insertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertMany(items: unknown[]) {
    try {
      const result = await this.collectionHumble.insertMany(items);
      // TODO: Is this mapping correct? Are we returning string representations of inserted object IDs?
      this.testAcknowledged(result);
      const insertedIds = Object.keys(result.insertedIds).map((item) => item.toString());
      if (insertedIds.length !== items.length) {
        throw new CamsError(this.moduleName, {
          message: 'Not all items inserted',
          data: insertedIds,
        });
      }
      return insertedIds;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async deleteOne(query: ConditionOrConjunction) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.deleteOne(mongoQuery);
      this.testAcknowledged(result);
      if (result.deletedCount !== 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async deleteMany(query: ConditionOrConjunction) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.deleteMany(mongoQuery);
      this.testAcknowledged(result);
      if (result.deletedCount < 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async countDocuments(query: ConditionOrConjunction | null) {
    const mongoQuery = query ? toMongoQuery(query) : {};
    try {
      return await this.collectionHumble.countDocuments(mongoQuery);
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }
}
