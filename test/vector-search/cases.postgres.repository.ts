/**
 * PostgreSQL Implementation of CasesRepository
 *
 * This demonstrates that the CAMS API can work with PostgreSQL as the persistence layer,
 * using JSONB for document storage and pgvector for vector search.
 *
 * This is a PROOF OF CONCEPT implementation focusing on searchCases() to show:
 * 1. JSONB document queries work like MongoDB
 * 2. Vector search with pgvector works like MongoDB Atlas
 * 3. Same API interface, different persistence tier
 */

import { Pool } from 'pg';
import { ApplicationContext } from '../../backend/lib/adapters/types/basic';
import { SyncedCase } from '../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../common/src/api/search';
import { CasesRepository, CamsPaginationResponse } from '../../backend/lib/use-cases/gateways.types';
import { ResourceActions } from '../../common/src/cams/actions';
import { getEmbeddingService } from '../../backend/lib/adapters/services/embedding.service';

const MODULE_NAME = 'CASES-POSTGRES-REPOSITORY';

export class CasesPostgresRepository implements Partial<CasesRepository> {
  private pool: Pool;
  private context: ApplicationContext;

  constructor(context: ApplicationContext, pool: Pool) {
    this.context = context;
    this.pool = pool;
  }

  /**
   * Search cases using PostgreSQL JSONB and pgvector.
   *
   * This implements the same interface as CasesMongoRepository.searchCases()
   * but uses PostgreSQL instead of MongoDB.
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
   * Traditional search using JSONB queries (no vector search).
   * This always works, even without pgvector.
   */
  private async traditionalSearch(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>> {
    const whereClauses: string[] = ['data @> \'{"documentType": "SYNCED_CASE"}\'::jsonb'];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clauses from predicate
    if (predicate.divisionCodes && predicate.divisionCodes.length > 0) {
      whereClauses.push(`data->>'courtDivisionCode' = ANY($${paramIndex})`);
      params.push(predicate.divisionCodes);
      paramIndex++;
    }

    if (predicate.chapters && predicate.chapters.length > 0) {
      whereClauses.push(`data->>'chapter' = ANY($${paramIndex})`);
      params.push(predicate.chapters);
      paramIndex++;
    }

    if (predicate.caseIds && predicate.caseIds.length > 0) {
      whereClauses.push(`data->>'caseId' = ANY($${paramIndex})`);
      params.push(predicate.caseIds);
      paramIndex++;
    }

    if (predicate.excludeClosedCases) {
      whereClauses.push(`(
        data->>'closedDate' IS NULL
        OR (
          data->>'reopenedDate' IS NOT NULL
          AND (data->>'reopenedDate')::timestamp >= (data->>'closedDate')::timestamp
        )
      )`);
    }

    const whereClause = whereClauses.join(' AND ');

    // Count total (for pagination metadata)
    const countQuery = `SELECT COUNT(*) as total FROM cases WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const limit = predicate.limit || 25;
    const offset = predicate.offset || 0;

    const dataQuery = `
      SELECT data
      FROM cases
      WHERE ${whereClause}
      ORDER BY (data->>'dateFiled')::timestamp DESC, data->>'caseNumber' DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await this.pool.query(dataQuery, [...params, limit, offset]);

    this.context.logger.debug(
      MODULE_NAME,
      `Traditional search returned ${dataResult.rowCount} cases (total: ${total})`,
    );

    return {
      data: dataResult.rows.map((row) => row.data as ResourceActions<SyncedCase>),
      metadata: { total },
    };
  }

  /**
   * Vector search using pgvector for fuzzy name matching.
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

    // Build WHERE clauses for traditional filters
    const whereClauses: string[] = [
      'data @> \'{"documentType": "SYNCED_CASE"}\'::jsonb',
      'keywords_vector IS NOT NULL', // Only search cases with vectors
    ];
    const params: any[] = [];
    let paramIndex = 1;

    if (predicate.divisionCodes && predicate.divisionCodes.length > 0) {
      whereClauses.push(`data->>'courtDivisionCode' = ANY($${paramIndex})`);
      params.push(predicate.divisionCodes);
      paramIndex++;
    }

    if (predicate.chapters && predicate.chapters.length > 0) {
      whereClauses.push(`data->>'chapter' = ANY($${paramIndex})`);
      params.push(predicate.chapters);
      paramIndex++;
    }

    if (predicate.excludeClosedCases) {
      whereClauses.push(`(
        data->>'closedDate' IS NULL
        OR (
          data->>'reopenedDate' IS NOT NULL
          AND (data->>'reopenedDate')::timestamp >= (data->>'closedDate')::timestamp
        )
      )`);
    }

    const whereClause = whereClauses.join(' AND ');
    const vectorString = `[${queryVector.join(',')}]`;

    // Determine k (number of results to retrieve from vector search)
    const k = Math.min((predicate.limit || 25) * 2, 100);

    // Count total matching cases (before vector ranking)
    const countQuery = `SELECT COUNT(*) as total FROM cases WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Perform hybrid search: vector similarity + traditional filters
    const limit = predicate.limit || 25;
    const offset = predicate.offset || 0;

    const searchQuery = `
      SELECT
        data,
        1 - (keywords_vector <=> $${paramIndex}::vector) AS similarity
      FROM cases
      WHERE ${whereClause}
      ORDER BY keywords_vector <=> $${paramIndex}::vector
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    const searchParams = [...params, vectorString, limit, offset];
    const searchResult = await this.pool.query(searchQuery, searchParams);

    this.context.logger.debug(
      MODULE_NAME,
      `Vector search for "${predicate.name}" returned ${searchResult.rowCount} cases (total: ${total}, k=${k})`,
    );

    return {
      data: searchResult.rows.map((row) => row.data as ResourceActions<SyncedCase>),
      metadata: { total },
    };
  }

  /**
   * Required by CasesRepository interface
   */
  release(): void {
    // PostgreSQL pool cleanup would go here if needed
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

  // For POC purposes, we're only implementing searchCases() to demonstrate
  // that the API can work with either MongoDB or PostgreSQL.
}
