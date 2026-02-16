import { PaginationParameters } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import { CamsError, isCamsError } from '../../../../common-errors/cams-error';
import { getCamsErrorWithStack } from '../../../../common-errors/error-utilities';
import { NotFoundError } from '../../../../common-errors/not-found-error';
import { UnknownError } from '../../../../common-errors/unknown-error';
import { GatewayTimeoutError } from '../../../../common-errors/gateway-timeout';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import { ConditionOrConjunction, Query, SortSpec } from '../../../../query/query-builder';
import QueryPipeline, { isPaginate, isPipeline, Pipeline } from '../../../../query/query-pipeline';
import {
  BulkReplaceResult,
  CamsPaginationResponse,
  DocumentCollectionAdapter,
  ReplaceResult,
  UpdateResult,
} from '../../../../use-cases/gateways.types';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';
import { randomUUID } from 'crypto';
import { Document as MongoDocument, MongoServerError } from 'mongodb';

export class MongoCollectionAdapter<T> implements DocumentCollectionAdapter<T> {
  private collectionHumble: CollectionHumble<T>;
  private readonly moduleName: string;

  constructor(moduleName: string, collection: CollectionHumble<T>) {
    this.collectionHumble = collection;
    this.moduleName = moduleName + '_ADAPTER';
  }

  async aggregate<U = T>(pipeline: Pipeline): Promise<U[]> {
    const mongoQuery = MongoAggregateRenderer.toMongoAggregate(pipeline);
    try {
      const aggregationResult = await this.collectionHumble.aggregate(mongoQuery);

      const data = [];
      for await (const result of aggregationResult) {
        data.push(result);
      }

      return data;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed while querying aggregate pipeline`, {
        pipeline,
      });
    }
  }

  public async paginate(
    pipelineOrQuery: Pipeline | ConditionOrConjunction,
    page: PaginationParameters = { offset: 0, limit: DEFAULT_SEARCH_LIMIT },
  ): Promise<CamsPaginationResponse<T>> {
    try {
      const pipeline = isPipeline(pipelineOrQuery)
        ? pipelineOrQuery
        : QueryPipeline.pipeline(QueryPipeline.match(pipelineOrQuery));

      const includesPagination = pipeline.stages.reduce((acc, stage) => {
        return acc || isPaginate(stage);
      }, false);

      if (!includesPagination) {
        pipeline.stages.push(QueryPipeline.paginate(page.offset, page.limit));
      }
      const mongoAggregate = MongoAggregateRenderer.toMongoAggregate(pipeline);

      const cursor = await this.collectionHumble.aggregate(mongoAggregate);
      const result = await cursor.next();

      return this.getPage<T>(result);
    } catch (originalError) {
      throw this.handleError(
        originalError,
        `Query failed. ${originalError.message}`,
        pipelineOrQuery,
      );
    }
  }

  getPage<T>(result: MongoDocument): CamsPaginationResponse<T> {
    return {
      metadata: result['metadata'] && result['metadata'][0] ? result['metadata'][0] : { total: 0 },
      data: result['data'] ?? [],
    };
  }

  public async find(query: Query<T>, sort?: SortSpec, limit?: number): Promise<T[]> {
    const mongoQuery = toMongoQuery<T>(query);
    const mongoSort = sort ? toMongoSort(sort) : undefined;
    try {
      const items: T[] = [];

      let cursor = await this.collectionHumble.find(mongoQuery);
      if (mongoSort) {
        cursor = cursor.sort(mongoSort);
      }
      if (limit !== undefined) {
        cursor = cursor.limit(limit);
      }
      for await (const doc of cursor) {
        items.push(doc as CamsItem<T>);
      }

      return items;
    } catch (originalError) {
      throw this.handleError(originalError, `Query failed. ${originalError.message}`, { query });
    }
  }

  public async getAll(sort?: SortSpec): Promise<T[]> {
    const mongoQuery = {};
    const mongoSort = sort ? toMongoSort(sort) : undefined;
    try {
      const findResult = await this.collectionHumble.find(mongoQuery);
      const results = mongoSort ? findResult.sort(mongoSort) : findResult;

      const items: T[] = [];
      for await (const doc of results) {
        items.push(doc as CamsItem<T>);
      }
      return items;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed to retrieve all. ${originalError.message}`, {
        sort,
      });
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
      throw this.handleError(originalError, `Query failed. ${originalError.message}`, { query });
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

      if (!result.acknowledged) {
        throw upsert ? unknownError : unknownMatchError;
      }
      if (result.upsertedCount + result.modifiedCount > 1) {
        throw unknownError;
      }
      if (upsert && result.upsertedCount < 1 && result.modifiedCount < 1) {
        throw unknownError;
      }
      if (!upsert && result.matchedCount === 0) {
        throw notFoundError;
      }
      if (!upsert && result.matchedCount > 0 && result.modifiedCount === 0) {
        throw unknownMatchError;
      }
      return {
        id: mongoItem.id,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
      };
    } catch (originalError) {
      throw this.handleError(originalError, `Failed to replace item. ${originalError.message}`, {
        query,
        item,
      });
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
      throw this.handleError(originalError, `Failed to replace item. ${originalError.message}`, {
        query,
        item: itemProperties,
      });
    }
  }

  public async updateMany(query: Query<T>, update: MongoDocument): Promise<UpdateResult> {
    const mongoQuery = toMongoQuery(query);

    try {
      const result = await this.collectionHumble.updateMany(mongoQuery, update);
      const unknownError = new UnknownError(this.moduleName, {
        message: 'Failed to update documents in database.',
      });

      if (!result.acknowledged) {
        throw unknownError;
      }

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      };
    } catch (originalError) {
      throw this.handleError(originalError, `Failed to update items. ${originalError.message}`, {
        query,
        update,
      });
    }
  }

  public async insertOne(item: T, options: { useProvidedId?: true } = {}) {
    try {
      let mongoItem: CamsItem<T>;
      if (options.useProvidedId && typeof item === 'object' && !!item['id']) {
        mongoItem = item as CamsItem<T>;
      } else {
        mongoItem = createOrGetId<T>(removeIds(item));
      }
      const result = await this.collectionHumble.insertOne(mongoItem);
      if (!result.acknowledged) {
        throw new UnknownError(this.moduleName, {
          message: 'Failed to insert document into database.',
        });
      }

      return mongoItem.id;
    } catch (originalError) {
      throw this.handleError(originalError, `Failed to insert item. ${originalError.message}`, {
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
      throw this.handleError(originalError, `Failed to insert items. ${originalError.message}`, {
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
      throw this.handleError(originalError, `Failed to delete item. ${originalError.message}`, {
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
      throw this.handleError(originalError, `Failed to delete items. ${originalError.message}`, {
        query,
      });
    }
  }

  public async countDocuments(query: Query<T>) {
    const mongoQuery = toMongoQuery<T>(query);
    try {
      return await this.collectionHumble.countDocuments(mongoQuery);
    } catch (originalError) {
      throw this.handleError(originalError, `Failed to count documents. ${originalError.message}`, {
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

  public async bulkReplace(
    replacements: Array<{ filter: Query<T>; replacement: T }>,
    upsert: boolean = true,
  ): Promise<BulkReplaceResult> {
    try {
      const operations = replacements.map((item) => ({
        replaceOne: {
          filter: toMongoQuery(item.filter),
          replacement: item.replacement,
          upsert,
        },
      }));

      return await this.collectionHumble.bulkWrite(operations);
    } catch (originalError) {
      throw this.handleError(originalError, 'Failed to execute bulk replace operation.');
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
    if (!isCamsError(error) && isTimeoutError(error)) {
      return new GatewayTimeoutError(this.moduleName, {
        message: `Query failed. Search request timed out.`,
        originalError: error instanceof Error ? error : undefined,
      });
    }
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

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes('timed out');
}

function createOrGetId<T>(item: CamsItem<T>): CamsItem<T> {
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
