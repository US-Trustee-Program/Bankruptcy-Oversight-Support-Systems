/**
 * MongoDB Atlas Collection Adapter
 *
 * This adapter extends the base MongoCollectionAdapter to use MongoAtlasAggregateRenderer
 * for vector search operations. It's specifically designed for MongoDB Atlas with vector
 * search support using the $vectorSearch operator.
 *
 * Key difference from base adapter:
 * - Uses MongoAtlasAggregateRenderer instead of MongoAggregateRenderer
 * - Supports $vectorSearch operator for Atlas Search vector indexes
 */

import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import { MongoCollectionAdapter } from './mongo-adapter';
import MongoAtlasAggregateRenderer from './mongo-atlas-aggregate-renderer';
import QueryPipeline, { isPaginate, isPipeline, Pipeline } from '../../../../query/query-pipeline';
import { ConditionOrConjunction } from '../../../../query/query-builder';
import { PaginationParameters } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import { CamsPaginationResponse } from '../../../../use-cases/gateways.types';

export class MongoAtlasCollectionAdapter<T> extends MongoCollectionAdapter<T> {
  constructor(moduleName: string, collection: CollectionHumble<T>) {
    super(moduleName, collection);
  }

  /**
   * Create a new Atlas-specific adapter instance.
   * Use this factory method instead of direct instantiation.
   */
  public static newAtlasAdapter<T>(
    moduleName: string,
    collection: string,
    database: string,
    client: DocumentClient,
  ) {
    return new MongoAtlasCollectionAdapter<T>(
      moduleName,
      client.database(database).collection<T>(collection),
    );
  }

  /**
   * Override aggregate to use MongoAtlasAggregateRenderer for vector search support.
   */
  async aggregate<U = T>(pipeline: Pipeline): Promise<U[]> {
    const mongoQuery = MongoAtlasAggregateRenderer.toMongoAtlasAggregate(pipeline);
    try {
      const collectionHumble = (this as unknown as { collectionHumble: CollectionHumble<T> })
        .collectionHumble;
      const aggregationResult = await collectionHumble.aggregate(mongoQuery);

      const data = [];
      for await (const result of aggregationResult) {
        data.push(result);
      }

      return data;
    } catch (originalError) {
      const handleError = (
        this as unknown as {
          handleError: (error: unknown, message: string, context: unknown) => Error;
        }
      ).handleError.bind(this);
      throw handleError(originalError, `Failed while querying aggregate pipeline`, {
        pipeline,
      });
    }
  }

  /**
   * Override paginate to use MongoAtlasAggregateRenderer for vector search support.
   */
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
      const mongoAggregate = MongoAtlasAggregateRenderer.toMongoAtlasAggregate(pipeline);

      const collectionHumble = (this as unknown as { collectionHumble: CollectionHumble<T> })
        .collectionHumble;
      const cursor = await collectionHumble.aggregate(mongoAggregate);
      const result = await cursor.next();

      return (
        this as unknown as { getPage: <U>(result: unknown) => CamsPaginationResponse<U> }
      ).getPage<T>(result);
    } catch (originalError) {
      const handleError = (
        this as unknown as {
          handleError: (error: unknown, message: string, context: unknown) => Error;
        }
      ).handleError.bind(this);
      throw handleError(
        originalError,
        `Query failed. ${(originalError as Error).message}`,
        pipelineOrQuery,
      );
    }
  }
}
