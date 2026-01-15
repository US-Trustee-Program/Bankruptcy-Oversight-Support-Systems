/**
 * Azure Cosmos DB vCore / DocumentDB Collection Adapter
 *
 * This adapter extends the base MongoCollectionAdapter to use MongoDocumentDbAggregateRenderer
 * for vector search operations. It's specifically designed for Azure Cosmos DB vCore (MongoDB API)
 * with vector search support using the $search.cosmosSearch operator.
 *
 * Key difference from base adapter:
 * - Uses MongoDocumentDbAggregateRenderer instead of MongoAggregateRenderer
 * - Supports $search.cosmosSearch operator for Cosmos DB vCore vector search
 *
 * Note: This is for Azure Cosmos DB for MongoDB vCore API, NOT the RU-based MongoDB API.
 */

import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import { MongoCollectionAdapter } from './mongo-adapter';
import MongoDocumentDbAggregateRenderer from './mongo-documentdb-aggregate-renderer';
import QueryPipeline, { isPaginate, isPipeline, Pipeline } from '../../../../query/query-pipeline';
import { ConditionOrConjunction } from '../../../../query/query-builder';
import { PaginationParameters } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import { CamsPaginationResponse } from '../../../../use-cases/gateways.types';

export class MongoDocumentDbCollectionAdapter<T> extends MongoCollectionAdapter<T> {
  constructor(moduleName: string, collection: CollectionHumble<T>) {
    super(moduleName, collection);
  }

  /**
   * Create a new DocumentDB/Cosmos vCore-specific adapter instance.
   * Use this factory method instead of direct instantiation.
   */
  public static newDocumentDbAdapter<T>(
    moduleName: string,
    collection: string,
    database: string,
    client: DocumentClient,
  ) {
    return new MongoDocumentDbCollectionAdapter<T>(
      moduleName,
      client.database(database).collection<T>(collection),
    );
  }

  /**
   * Override aggregate to use MongoDocumentDbAggregateRenderer for vector search support.
   */
  async aggregate<U = T>(pipeline: Pipeline): Promise<U[]> {
    const mongoQuery = MongoDocumentDbAggregateRenderer.toMongoDocumentDbAggregate(pipeline);
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
   * Override paginate to use MongoDocumentDbAggregateRenderer for vector search support.
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
      const mongoAggregate = MongoDocumentDbAggregateRenderer.toMongoDocumentDbAggregate(pipeline);

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
