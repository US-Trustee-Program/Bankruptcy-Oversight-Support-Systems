import { NotFoundError } from '../../../common-errors/not-found-error';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CollectionHumble, DocumentClient } from '../../../humble-objects/mongo-humble';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsError } from '../../../common-errors/cams-error';
import { ConditionOrConjunction, Sort } from '../../../query/query-builder';
import { DocumentCollectionAdapter } from '../document-collection.adapter';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';
import { ObjectId } from 'mongodb';

export class MongoCollectionAdapter<T> implements DocumentCollectionAdapter<T> {
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

  public async find(query: ConditionOrConjunction | null, sort?: Sort): Promise<T[]> {
    const mongoQuery = query ? toMongoQuery(query) : {};
    const mongoSort = sort ? toMongoSort(sort) : undefined;
    try {
      const findPromise = this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? (await findPromise).sort(mongoSort) : await findPromise;

      const items: T[] = [];
      for await (const doc of results) {
        items.push(toCamsItem<T>(doc as MongoItem<T>));
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
      return toCamsItem<T>(result);
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async replaceOne(query: ConditionOrConjunction, item: T, upsert: boolean = false) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.replaceOne(
        mongoQuery,
        toMongoItem<T>(item),
        upsert,
      );
      this.testAcknowledged(result);

      return result.upsertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertOne(item: T) {
    try {
      const result = await this.collectionHumble.insertOne(toMongoItem<T>(item));
      this.testAcknowledged(result);

      return result.insertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertMany(items: T[]) {
    try {
      const mongoItems = items.map((item) => toMongoItem<T>(item));
      const result = await this.collectionHumble.insertMany(mongoItems);
      this.testAcknowledged(result);
      const insertedIds = Object.keys(result.insertedIds).map((insertedId) =>
        insertedId.toString(),
      );
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

  public static newAdapter<T>(
    moduleName: string,
    collection: string,
    database: string,
    client: DocumentClient,
  ) {
    return new MongoCollectionAdapter<T>(
      moduleName,
      client.database(database).collection<T>(collection),
    );
  }
}

function toMongoItem<T>(item: CamsItem<T>): MongoItem<T> {
  const _id = new ObjectId(item.id);
  const mongoItem = {
    ...item,
    _id,
  };
  delete mongoItem.id;
  return mongoItem;
}

function toCamsItem<T>(item: MongoItem<T>): CamsItem<T> {
  const id = item._id?.toString();
  const camsItem = {
    ...item,
    id,
  };
  delete camsItem._id;
  return camsItem;
}

type MongoItem<T> = T & {
  _id?: unknown;
};

type CamsItem<T> = T & {
  id?: string;
};
