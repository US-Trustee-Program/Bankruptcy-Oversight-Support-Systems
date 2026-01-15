/**
 * MongoDB Atlas Implementation of CasesRepository
 *
 * This demonstrates that the CAMS API can work with MongoDB Atlas vector search.
 * This is a TEST implementation to validate the correct syntax before updating production code.
 *
 * Key difference from current implementation:
 * - Uses $vectorSearch operator (Atlas) instead of $search.cosmosSearch (Cosmos DB vCore)
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { ApplicationContext } from '../../backend/lib/adapters/types/basic';
import { SyncedCase } from '../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../common/src/api/search';
import { CasesRepository, CamsPaginationResponse } from '../../backend/lib/use-cases/gateways.types';
import { ResourceActions } from '../../common/src/cams/actions';
import { getEmbeddingService } from '../../backend/lib/adapters/services/embedding.service';

const MODULE_NAME = 'CASES-ATLAS-REPOSITORY';

export class CasesAtlasRepository implements Partial<CasesRepository> {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<SyncedCase>;
  private context: ApplicationContext;

  constructor(context: ApplicationContext, connectionString: string, databaseName: string) {
    this.context = context;
    this.client = new MongoClient(connectionString);
    this.db = this.client.db(databaseName);
    this.collection = this.db.collection<SyncedCase>('cases');
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Search cases using MongoDB Atlas vector search or traditional queries.
   *
   * This implements the same interface as CasesMongoRepository.searchCases()
   * but uses MongoDB Atlas $vectorSearch instead of Cosmos DB cosmosSearch.
   */
  async searchCases(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>> {
    try {
      // Handle vector search if name is provided
      if (predicate.name && predicate.name.trim().length > 0) {
        return await this.searchCasesWithVectorSearch(predicate);
      }

      // Traditional search without vector similarity
      return await this.traditionalSearch(predicate);
    } catch (error) {
      this.context.logger.error(MODULE_NAME, 'Failed to search cases', error);
      throw error;
    }
  }

  /**
   * Traditional search using MongoDB queries (no vector search).
   */
  private async traditionalSearch(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>> {
    const matchConditions: any = { documentType: 'SYNCED_CASE' };

    // Build match conditions from predicate
    if (predicate.divisionCodes && predicate.divisionCodes.length > 0) {
      matchConditions.courtDivisionCode = { $in: predicate.divisionCodes };
    }

    if (predicate.chapters && predicate.chapters.length > 0) {
      matchConditions.chapter = { $in: predicate.chapters };
    }

    if (predicate.caseIds && predicate.caseIds.length > 0) {
      matchConditions.caseId = { $in: predicate.caseIds };
    }

    if (predicate.excludeClosedCases) {
      matchConditions.$or = [
        { closedDate: { $exists: false } },
        { closedDate: null },
        {
          $expr: {
            $gte: [{ $toDate: '$reopenedDate' }, { $toDate: '$closedDate' }],
          },
        },
      ];
    }

    // Count total (for pagination metadata)
    const total = await this.collection.countDocuments(matchConditions);

    // Get paginated results
    const limit = predicate.limit || 25;
    const offset = predicate.offset || 0;

    const results = await this.collection
      .find(matchConditions)
      .sort({ dateFiled: -1, caseNumber: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    this.context.logger.debug(
      MODULE_NAME,
      `Traditional search returned ${results.length} cases (total: ${total})`,
    );

    return {
      data: results as ResourceActions<SyncedCase>[],
      metadata: { total },
    };
  }

  /**
   * Vector search using MongoDB Atlas $vectorSearch operator.
   * Falls back to traditional search if embedding generation fails.
   */
  private async searchCasesWithVectorSearch(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>> {
    const embeddingService = getEmbeddingService();

    // Generate embedding for search name
    this.context.logger.debug(MODULE_NAME, `Generating embedding for name: ${predicate.name}`);
    const queryVector = await embeddingService.generateEmbedding(this.context, predicate.name!);

    if (!queryVector) {
      this.context.logger.warn(
        MODULE_NAME,
        `Failed to generate embedding for name: ${predicate.name}, falling back to traditional search`,
      );
      // Fall back to traditional search
      const { name, ...predicateWithoutName } = predicate;
      return await this.traditionalSearch(predicateWithoutName);
    }

    this.context.logger.debug(MODULE_NAME, `Query vector generated: ${queryVector.length} dimensions`);

    // Build match conditions for traditional filters
    const matchConditions: any = { documentType: 'SYNCED_CASE' };

    if (predicate.divisionCodes && predicate.divisionCodes.length > 0) {
      matchConditions.courtDivisionCode = { $in: predicate.divisionCodes };
    }

    if (predicate.chapters && predicate.chapters.length > 0) {
      matchConditions.chapter = { $in: predicate.chapters };
    }

    if (predicate.excludeClosedCases) {
      matchConditions.$or = [
        { closedDate: { $exists: false } },
        { closedDate: null },
        {
          $expr: {
            $gte: [{ $toDate: '$reopenedDate' }, { $toDate: '$closedDate' }],
          },
        },
      ];
    }

    // Determine number of candidates to retrieve
    const limit = predicate.limit || 25;
    const offset = predicate.offset || 0;
    const numCandidates = Math.min((limit + offset) * 2, 100);

    // Build MongoDB Atlas vector search pipeline
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'vector_index', // Try standard vector index name
          path: 'keywordsVector',
          queryVector: queryVector,
          numCandidates: numCandidates,
          limit: limit + offset, // Get enough for offset
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: matchConditions,
      },
      {
        $sort: { score: -1 },
      },
      {
        $skip: offset,
      },
      {
        $limit: limit,
      },
    ];

    this.context.logger.debug(
      MODULE_NAME,
      `Vector search with numCandidates=${numCandidates}, offset=${offset}, limit=${limit}`,
    );

    const results = await this.collection.aggregate(pipeline).toArray();

    // Count total matching documents (for pagination metadata)
    const countPipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'keywordsVector',
          queryVector: queryVector,
          numCandidates: 1000, // Large number for count
          limit: 1000,
        },
      },
      {
        $match: matchConditions,
      },
      {
        $count: 'total',
      },
    ];

    const countResult = await this.collection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : results.length;

    this.context.logger.debug(
      MODULE_NAME,
      `Vector search for "${predicate.name}" returned ${results.length} cases (total: ${total})`,
    );

    return {
      data: results as ResourceActions<SyncedCase>[],
      metadata: { total },
    };
  }

  /**
   * Required by CasesRepository interface
   */
  release(): void {
    this.client.close().catch((err) => {
      this.context.logger.error(MODULE_NAME, 'Error closing MongoDB connection', err);
    });
    this.context.logger.debug(MODULE_NAME, 'Repository released');
  }

  // Other CasesRepository methods would be implemented here:
  // - createTransferFrom
  // - createTransferTo
  // - getTransfers
  // - createConsolidationTo
  // - createConsolidationFrom
  // - getConsolidation
  // - getCaseHistory
  // - createCaseHistory
  // - syncDxtrCase
  // - getConsolidationMemberCaseIds
  // - getSyncedCase

  // For testing purposes, we're only implementing searchCases() to demonstrate
  // that the API can work with MongoDB Atlas vector search.
}
