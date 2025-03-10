import { CamsError, isCamsError } from '../../../../common-errors/cams-error';
import { getCamsErrorWithStack } from '../../../../common-errors/error-utilities';
import { NotFoundError } from '../../../../common-errors/not-found-error';
import { UnknownError } from '../../../../common-errors/unknown-error';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import { isPagination, Pagination, Query, Sort } from '../../../../query/query-builder';
import {
  CamsPaginationResponse,
  DocumentCollectionAdapter,
  ReplaceResult,
} from '../../../../use-cases/gateways.types';
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

  public async paginatedFind(query: Pagination<T>): Promise<CamsPaginationResponse<T>> {
    const mongoQuery = toMongoQuery<T>(query);
    const countQuery = toMongoQuery<T>(query.values[0]);
    try {
      if (!isPagination(query)) {
        throw new Error('Trying to paginate for a query that is not a pagination query');
      }

      const aggregationResult = await this.collectionHumble.aggregate(mongoQuery);
      const totalCountPromise = this.collectionHumble.countDocuments(countQuery);

      const aggregationItem: CamsPaginationResponse<T> = {
        metadata: { total: 0 },
        data: [],
      };

      for await (const result of aggregationResult) {
        for (const doc of result.data) {
          aggregationItem.data.push(doc as CamsItem<T>);
        }
      }

      aggregationItem.metadata.total = await totalCountPromise;
      return aggregationItem;
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while querying with: ${JSON.stringify(query)}`,
        { query },
      );
    }
  }

  public async find(query: Query<T>, sort?: Sort<T>): Promise<T[]> {
    const mongoQuery = toMongoQuery<T>(query);
    const mongoSort = sort ? toMongoSort<T>(sort) : undefined;
    try {
      const items: T[] = [];

      const findPromise = this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? (await findPromise).sort(mongoSort) : await findPromise;
      for await (const doc of results) {
        items.push(doc as CamsItem<T>);
      }

      return items;
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while querying with: ${JSON.stringify(query)}`,
        { query },
      );
    }
  }

  public async getAll(sort?: Sort<T>): Promise<T[]> {
    const mongoQuery = {};
    const mongoSort = sort ? toMongoSort<T>(sort) : undefined;
    try {
      const findPromise = this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? (await findPromise).sort(mongoSort) : await findPromise;

      const items: T[] = [];
      for await (const doc of results) {
        items.push(doc as CamsItem<T>);
      }
      return items;
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed to retrieve all with sort: ${JSON.stringify(sort)}`,
        { sort },
      );
    }
  }

  public async findOne(query: Query<T>): Promise<T> {
    const mongoQuery = toMongoQuery<T>(query);
    try {
      const result = await this.collectionHumble.findOne<T>(mongoQuery);
      if (!result) {
        throw new NotFoundError(this.moduleName, { message: 'No matching item found.' });
      }
      return result;
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while querying with: ${JSON.stringify(query)}`,
        { query },
      );
    }
  }

  /**
   * Replace an existing item. Optionally create if one does not exist.
   * @param {Query} query Query used to find the item to replace.
   * @param item The item to be persisted.
   * @param {boolean} [upsert=false] Flag indicating whether the upsert operation should be performed if no matching item is found.
   * @returns {string} Returns the id of the item replaced or upserted.
   */
  public async replaceOne(
    query: Query<T>,
    item: T,
    upsert: boolean = false,
  ): Promise<ReplaceResult> {
    const mongoQuery = toMongoQuery<T>(query);
    const mongoItem = createOrGetId<T>(item);
    try {
      const result = await this.collectionHumble.replaceOne(mongoQuery, mongoItem, upsert);

      const unknownError = new UnknownError(this.moduleName, {
        message: 'Failed to insert document into database.',
      });
      const notFoundError = new NotFoundError(this.moduleName, {
        message: 'No matching item found.',
      });
      const unknownMatchError = new NotFoundError(this.moduleName, {
        message: `Failed to update document. Query matched ${result.matchedCount} items.`,
      });

      if (!result.acknowledged) throw upsert ? unknownError : unknownMatchError;
      if (result.upsertedCount + result.modifiedCount > 1) throw unknownError;
      if (upsert && result.upsertedCount < 1 && result.modifiedCount < 1) throw unknownError;
      if (!upsert && result.matchedCount === 0) throw notFoundError;
      if (!upsert && result.matchedCount > 0 && result.modifiedCount === 0) throw unknownMatchError;
      return {
        id: mongoItem.id,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
      };
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while replacing: query:${JSON.stringify(query)} item: ${JSON.stringify(item)}`,
        { query, item },
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
      throw this.handleError(originalError, `Failed while inserting: ${JSON.stringify(item)}`, {
        item,
      });
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
      throw this.handleError(originalError, `Failed while inserting: ${JSON.stringify(items)}`, {
        items,
      });
    }
  }

  public async deleteOne(query: Query<T>) {
    const mongoQuery = toMongoQuery<T>(query);
    try {
      const result = await this.collectionHumble.deleteOne(mongoQuery);
      if (result.deletedCount !== 1) {
        throw new NotFoundError(this.moduleName, {
          message: `Matched and deleted ${result.deletedCount} items.`,
        });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while deleting: ${JSON.stringify(query)}`, {
        query,
      });
    }
  }

  public async deleteMany(query: Query<T>) {
    const mongoQuery = toMongoQuery<T>(query);
    try {
      const result = await this.collectionHumble.deleteMany(mongoQuery);
      if (result.deletedCount < 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while deleting: ${JSON.stringify(query)}`, {
        query,
      });
    }
  }

  public async countDocuments(query: Query<T>) {
    const mongoQuery = toMongoQuery<T>(query);
    try {
      return await this.collectionHumble.countDocuments(mongoQuery);
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while counting: ${JSON.stringify(query)}`, {
        query,
      });
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

  private handleError(error: unknown, message: string, data?: object): CamsError {
    let mongoError: MongoServerError;
    let err: Error;
    if (!isCamsError(error)) {
      mongoError = error as MongoServerError;
      err = {
        name: mongoError.name,
        message: mongoError.message,
      } as unknown as Error;
    } else {
      err = error;
    }
    return getCamsErrorWithStack(err, this.moduleName, {
      camsStackInfo: { module: this.moduleName, message: err.message },
      message,
      data,
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
