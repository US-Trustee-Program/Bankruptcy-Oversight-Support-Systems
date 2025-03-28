import { CamsError, isCamsError } from '../../../../common-errors/cams-error';
import { getCamsErrorWithStack } from '../../../../common-errors/error-utilities';
import { NotFoundError } from '../../../../common-errors/not-found-error';
import { UnknownError } from '../../../../common-errors/unknown-error';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import {
  isCondition,
  isConjunction,
  isPagination,
  Pagination,
  Query,
  Sort,
} from '../../../../query/query-builder';
import { isPaginate, isPipeline, Pipeline } from '../../../../query/query-pipeline';
import {
  CamsPaginationResponse,
  DocumentCollectionAdapter,
  ReplaceResult,
  UpdateResult,
} from '../../../../use-cases/gateways.types';
import { toMongoAggregate } from './mongo-aggregate-renderer';
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

  // TODO: prototype code here. Trying to create a single entry point for find that can take query builder or query pipeline arguments.
  public async find2(query: Query<T> | Pipeline) {
    if (isPipeline(query)) {
      if (isPaginate(query.stages[query.stages.length - 1])) {
        return this._paginate(query);
      } else {
        return this._aggregate(query);
      }
    } else if (isCondition(query) || isConjunction(query)) {
      return this._find(query);
    } else {
      throw new Error('Invalid query type');
    }
  }

  async _find(query: Query<T>) {
    const _mongoQuery = toMongoQuery<T>(query);
  }

  async _paginate<U = T>(pipeline: Pipeline): Promise<CamsPaginationResponse<U>> {
    const mongoQuery = toMongoAggregate(pipeline);
    try {
      // This is the shape we map to.
      const aggregationItem: CamsPaginationResponse<U> = {
        metadata: { total: 0 },
        data: [],
      };

      const aggregationResult = await this.collectionHumble.aggregate(mongoQuery);

      // TODO: How do we refactor to get the total count?
      // aggregationItem.metadata.total = await this.collectionHumble.countDocuments();

      for await (const result of aggregationResult) {
        for (const doc of result.data) {
          aggregationItem.data.push(doc as CamsItem<U>);
        }
      }

      return aggregationItem;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while querying aggregate pipeline`, {
        pipeline,
      });
    }
  }

  async _aggregate<U = T>(pipeline: Pipeline): Promise<U[]> {
    const mongoQuery = toMongoAggregate(pipeline);
    try {
      const aggregationResult = await this.collectionHumble.aggregate(mongoQuery);

      const data = [];
      // TODO: see if we can skip the for looping
      for await (const result of aggregationResult) {
        for (const doc of result.data) {
          data.push(doc as CamsItem<U>);
        }
      }

      return data;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while querying aggregate pipeline`, {
        pipeline,
      });
    }
  }

  public async paginatedFind(query: Pagination<T>): Promise<CamsPaginationResponse<T>> {
    const mongoQuery = toMongoQuery<T>(query);
    const countQuery = toMongoQuery<T>(query.values[0]);
    try {
      if (!isPagination(query)) {
        throw new Error('Trying to paginate for a query that is not a pagination query');
      }

      const aggregationItem: CamsPaginationResponse<T> = {
        metadata: { total: 0 },
        data: [],
      };

      const aggregationResult = await this.collectionHumble.aggregate(mongoQuery);
      aggregationItem.metadata.total = await this.collectionHumble.countDocuments(countQuery);

      for await (const result of aggregationResult) {
        for (const doc of result.data) {
          aggregationItem.data.push(doc as CamsItem<T>);
        }
      }

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

  public async updateOne(query: Query<T>, itemProperties: Partial<T>): Promise<UpdateResult> {
    const mongoQuery = toMongoQuery(query);

    try {
      const result = await this.collectionHumble.updateOne(mongoQuery, itemProperties);
      const unknownError = new UnknownError(this.moduleName, {
        message: 'Failed to insert document into database.',
      });
      const notFoundError = new NotFoundError(this.moduleName, {
        message: 'No matching item found.',
      });

      if (!result.acknowledged) {
        throw unknownError;
      }

      if (!result.matchedCount) {
        throw notFoundError;
      }

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      };
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Failed while replacing: query:${JSON.stringify(query)} item: ${JSON.stringify(itemProperties)}`,
        { query, item: itemProperties },
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

export function createOrGetId<T>(item: CamsItem<T>): CamsItem<T> {
  return {
    id: randomUUID(),
    ...item,
  };
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
