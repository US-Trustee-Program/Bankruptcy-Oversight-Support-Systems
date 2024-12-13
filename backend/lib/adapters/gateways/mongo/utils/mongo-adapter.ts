import { CamsError } from '../../../../common-errors/cams-error';
import { getCamsErrorWithStack } from '../../../../common-errors/error-utilities';
import { NotFoundError } from '../../../../common-errors/not-found-error';
import { UnknownError } from '../../../../common-errors/unknown-error';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import { ConditionOrConjunction, Sort } from '../../../../query/query-builder';
import { DocumentCollectionAdapter } from '../../../../use-cases/gateways.types';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';
import { randomUUID } from 'crypto';
import { MongoServerError } from 'mongodb';

export class MongoCollectionAdapter<T> implements DocumentCollectionAdapter<T> {
  private collectionHumble: CollectionHumble<T>;
  private readonly moduleName: string;

  constructor(moduleName: string, collection: CollectionHumble<T>) {
    this.collectionHumble = collection;
    this.moduleName = moduleName + '_ADAPTER';
  }

  public async find(query: ConditionOrConjunction, sort?: Sort): Promise<T[]> {
    const mongoQuery = toMongoQuery(query);
    const mongoSort = sort ? toMongoSort(sort) : undefined;
    try {
      const findPromise = this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? (await findPromise).sort(mongoSort) : await findPromise;

      const items: T[] = [];
      for await (const doc of results) {
        items.push(doc as CamsItem<T>);
      }
      return items;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while querying with: ${JSON.stringify(query)}`);
    }
  }

  public async getAll(sort?: Sort): Promise<T[]> {
    const mongoQuery = {};
    const mongoSort = sort ? toMongoSort(sort) : undefined;
    try {
      const findPromise = this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? (await findPromise).sort(mongoSort) : await findPromise;

      const items: T[] = [];
      for await (const doc of results) {
        items.push(doc as CamsItem<T>);
      }
      return items;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while sorting with: ${JSON.stringify(sort)}`);
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
      throw this.handleError(originalError, `Failed while querying with: ${JSON.stringify(query)}`);
    }
  }

  public async replaceOne(query: ConditionOrConjunction, item: T, upsert: boolean = false) {
    const mongoQuery = toMongoQuery(query);
    const mongoItem = createOrGetId<T>(item);
    try {
      const result = await this.collectionHumble.replaceOne(mongoQuery, mongoItem, upsert);
      if (!result.acknowledged) {
        if (upsert) {
          throw new UnknownError(this.moduleName, {
            message: 'Failed to insert document into database.',
          });
        } else {
          throw new NotFoundError(this.moduleName, { message: 'No matching item found.' });
        }
      }
      return mongoItem.id;
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while replacing: query:${JSON.stringify(query)} item: ${JSON.stringify(item)}`,
      );
    }
  }

  public async insertOne(item: T) {
    try {
      const cleanItem = removeIds(item);
      const mongoItem = createOrGetId<T>(cleanItem);
      const result = await this.collectionHumble.insertOne(mongoItem);
      if (!result.acknowledged) {
        throw new UnknownError(this.moduleName, {
          message: 'Failed to insert document into database.',
        });
      }

      return mongoItem.id;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while inserting: ${JSON.stringify(item)}`);
    }
  }

  public async insertMany(items: T[]) {
    try {
      const mongoItems = items.map((item) => {
        const cleanItem = removeIds(item);
        return createOrGetId<T>(cleanItem);
      });
      const result = await this.collectionHumble.insertMany(mongoItems);
      const insertedIds = mongoItems.map((item) => item.id);
      if (insertedIds.length !== result.insertedCount) {
        throw new CamsError(this.moduleName, {
          message: 'Not all items inserted',
          data: insertedIds,
        });
      }
      return insertedIds;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while inserting: ${JSON.stringify(items)}`);
    }
  }

  public async deleteOne(query: ConditionOrConjunction) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.deleteOne(mongoQuery);
      if (result.deletedCount !== 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while deleting: ${JSON.stringify(query)}`);
    }
  }

  public async deleteMany(query: ConditionOrConjunction) {
    const mongoQuery = toMongoQuery(query);
    try {
      const result = await this.collectionHumble.deleteMany(mongoQuery);
      if (result.deletedCount < 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while deleting: ${JSON.stringify(query)}`);
    }
  }

  public async countDocuments(query: ConditionOrConjunction) {
    const mongoQuery = toMongoQuery(query);
    try {
      return await this.collectionHumble.countDocuments(mongoQuery);
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while counting: ${JSON.stringify(query)}`);
    }
  }

  public async countAllDocuments() {
    const mongoQuery = {};
    try {
      return await this.collectionHumble.countDocuments(mongoQuery);
    } catch (originalError) {
      throw this.handleError(originalError, 'Failed while counting all documents.');
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

  private handleError(error: unknown, message: string): CamsError {
    if (error instanceof MongoServerError) {
      error = new Error(error.errorResponse.message);
    }
    const mongoError = error as MongoServerError;
    return getCamsErrorWithStack(mongoError.cause ?? (error as Error), this.moduleName, {
      camsStackInfo: { module: this.moduleName, message },
    });
  }
}

function createOrGetId<T>(item: CamsItem<T>): CamsItem<T> {
  const mongoItem = {
    id: randomUUID(),
    ...item,
  };
  return mongoItem;
}

// TODO: sus.
export function removeIds<T>(item: CamsItem<T>): CamsItem<T> {
  const cleanItem = { ...item };
  delete cleanItem._id;
  delete cleanItem.id;
  return cleanItem;
}

type CamsItem<T> = T & {
  _id?: unknown;
  id?: string;
};
