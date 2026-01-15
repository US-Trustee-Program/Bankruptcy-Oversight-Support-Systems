import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '@common/cams/events';
import { ApplicationContext } from '../../types/basic';
import { CaseHistory } from '@common/cams/history';
import QueryBuilder, { ConditionOrConjunction, Field } from '../../../query/query-builder';
import { CamsPaginationResponse, CasesRepository } from '../../../use-cases/gateways.types';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { SyncedCase } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsError } from '../../../common-errors/cams-error';
import QueryPipeline from '../../../query/query-pipeline';
import { CaseAssignment } from '@common/cams/assignments';
import { getEmbeddingService } from '../../services/embedding.service';
import { MongoAtlasCollectionAdapter } from './utils/mongo-atlas-adapter';

const MODULE_NAME = 'CASES-ATLAS-REPOSITORY';
const COLLECTION_NAME = 'cases';

const { and, or, using } = QueryBuilder;
const {
  addFields,
  additionalField,
  descending,
  exclude,
  join,
  match,
  paginate,
  pipeline,
  sort,
  source,
  vectorSearch,
} = QueryPipeline;

function hasRequiredSearchFields(predicate: CasesSearchPredicate) {
  return predicate.limit && predicate.offset >= 0;
}

/**
 * Cases Repository Implementation for MongoDB Atlas
 *
 * This repository is specifically designed for MongoDB Atlas with vector search support.
 * It uses the MongoAtlasAggregateRenderer to generate $vectorSearch stages.
 *
 * Key Features:
 * - Fuzzy name search using vector embeddings
 * - Uses MongoDB Atlas $vectorSearch operator
 * - Falls back to traditional search if vector generation fails
 * - Supports all standard CasesRepository operations
 *
 * Vector Search Flow:
 * 1. User provides predicate.name (e.g., "John Smith")
 * 2. EmbeddingService generates 384-dimensional vector from name
 * 3. Pipeline applies traditional filters first (division, chapter, etc.)
 * 4. $vectorSearch finds similar vectors in keywordsVector field
 * 5. Results sorted and paginated
 *
 * Architecture Note:
 * This is separate from CasesMongoRepository which targets Azure Cosmos DB
 * with MongoDB API (RU-based model) that does NOT support vector search.
 */
export class CasesAtlasRepository extends BaseMongoRepository implements CasesRepository {
  private static referenceCount: number = 0;
  private static instance: CasesAtlasRepository;
  private context: ApplicationContext;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
  }

  public static getInstance(context: ApplicationContext) {
    if (!CasesAtlasRepository.instance) {
      CasesAtlasRepository.instance = new CasesAtlasRepository(context);
    }
    CasesAtlasRepository.referenceCount++;
    return CasesAtlasRepository.instance;
  }

  public static dropInstance() {
    if (CasesAtlasRepository.referenceCount > 0) {
      CasesAtlasRepository.referenceCount--;
    }
    if (CasesAtlasRepository.referenceCount < 1) {
      CasesAtlasRepository.instance?.client?.close().then();
      CasesAtlasRepository.instance = null;
    }
  }

  public release() {
    CasesAtlasRepository.dropInstance();
  }

  /**
   * Override getAdapter to return MongoDB Atlas-specific adapter.
   * This adapter uses MongoAtlasAggregateRenderer for vector search support.
   */
  protected getAdapter<T>() {
    return MongoAtlasCollectionAdapter.newAtlasAdapter<T>(
      this.moduleName,
      this.collectionName,
      this.databaseName,
      this.client,
    );
  }

  async getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>> {
    const doc = using<Transfer>();
    try {
      const query = and(doc('documentType').regex('^TRANSFER_'), doc('caseId').equals(caseId));
      const adapter = this.getAdapter<Transfer>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to get transfers for ${caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  private async create<T>(itemToCreate: T): Promise<T> {
    try {
      const adapter = this.getAdapter<T>();
      const id = await adapter.insertOne(itemToCreate);
      return { ...itemToCreate, id };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to create item.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async createTransferFrom(transferFrom: TransferFrom): Promise<TransferFrom> {
    try {
      return await this.create<TransferFrom>(transferFrom);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to create transferFrom for: ${transferFrom.caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async createTransferTo(transferOut: TransferTo): Promise<TransferTo> {
    try {
      return await this.create<TransferTo>(transferOut);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to create transferTo for: ${transferOut.caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async getConsolidation(caseId: string): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    const doc = using<ConsolidationTo | ConsolidationFrom>();
    try {
      const query = and(doc('documentType').regex('^CONSOLIDATION_'), doc('caseId').equals(caseId));
      const adapter = this.getAdapter<ConsolidationTo | ConsolidationFrom>();
      return await adapter.find(query);
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve consolidation for ${caseId}.`,
          module: MODULE_NAME,
        },
      });
      throw error;
    }
  }

  async createConsolidationFrom(consolidationFrom: ConsolidationFrom): Promise<ConsolidationFrom> {
    try {
      return await this.create<ConsolidationFrom>(consolidationFrom);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to create consolidationFrom for: ${consolidationFrom.caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async createConsolidationTo(consolidationOut: ConsolidationTo): Promise<ConsolidationTo> {
    try {
      return await this.create<ConsolidationTo>(consolidationOut);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to create consolidationTo for: ${consolidationOut.caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async getCaseHistory(caseId: string): Promise<CaseHistory[]> {
    const doc = using<CaseHistory>();
    try {
      const query = and(doc('documentType').regex('^AUDIT_'), doc('caseId').equals(caseId));
      const adapter = this.getAdapter<CaseHistory>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to get case history for ${caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async createCaseHistory(history: CaseHistory) {
    try {
      await this.create<CaseHistory>(history);
      this.context.logger.debug(MODULE_NAME, `Created case history for: ${history.caseId}.`);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message:
            'Unable to create case history. Please try again later. If the problem persists, please contact USTP support.',
          module: MODULE_NAME,
        },
      });
    }
  }

  async syncDxtrCase(bCase: SyncedCase): Promise<void> {
    const doc = using<SyncedCase>();
    const query = and(
      doc('caseId').equals(bCase.caseId),
      doc('documentType').equals('SYNCED_CASE'),
    );
    try {
      await this.getAdapter<SyncedCase>().replaceOne(query, bCase, true);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getConsolidationMemberCaseIds(predicate: CasesSearchPredicate): Promise<string[]> {
    const doc = using<ConsolidationTo>();
    try {
      const conditions: ConditionOrConjunction<ConsolidationTo>[] = [];
      conditions.push(doc('documentType').equals('CONSOLIDATION_TO'));

      if (predicate.caseIds?.length > 0) {
        conditions.push(doc('caseId').contains(predicate.caseIds));
      }

      if (predicate.divisionCodes?.length > 0) {
        const matchers: ConditionOrConjunction<ConsolidationTo>[] = [];
        predicate.divisionCodes.forEach((code) => {
          matchers.push(doc('caseId').regex(`^${code}`));
        });
        conditions.push(or(...matchers));
      }
      const query = and(...conditions);

      const adapter = this.getAdapter<ConsolidationTo>();
      const memberConsolidations = await adapter.find(query);

      const memberConsolidationCaseIds: string[] = [];
      for (const consolidationTo of memberConsolidations) {
        memberConsolidationCaseIds.push(consolidationTo.caseId);
      }
      return memberConsolidationCaseIds;
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve member consolidations${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
          module: MODULE_NAME,
        },
      });
      throw error;
    }
  }

  addConditions(predicate: CasesSearchPredicate): ConditionOrConjunction<SyncedCase>[] {
    const doc = using<SyncedCase>();
    const conditions: ConditionOrConjunction<SyncedCase>[] = [];
    conditions.push(doc('documentType').equals('SYNCED_CASE'));

    if (predicate.caseNumber) {
      conditions.push(doc('caseNumber').equals(predicate.caseNumber));
    }

    if (predicate.caseIds) {
      conditions.push(doc('caseId').contains(predicate.caseIds));
    }

    if (predicate.chapters?.length > 0) {
      conditions.push(doc('chapter').contains(predicate.chapters));
    }

    if (predicate.divisionCodes?.length > 0) {
      conditions.push(doc('courtDivisionCode').contains(predicate.divisionCodes));
    }

    if (predicate.excludeMemberConsolidations === true && predicate.excludedCaseIds?.length > 0) {
      conditions.push(doc('caseId').notContains(predicate.excludedCaseIds));
    }

    if (predicate.excludeClosedCases === true) {
      conditions.push(
        or(
          doc('closedDate').notExists(),
          and(
            doc('closedDate').exists(),
            doc('reopenedDate').exists(),
            doc('reopenedDate').greaterThanOrEqual({ name: 'closedDate' }),
          ),
        ),
      );
    }
    return conditions;
  }

  /**
   * Search cases with optional vector search support.
   *
   * This is where the magic happens! If predicate.name is provided:
   * 1. **Vector Encoding Occurs Here** - EmbeddingService.generateEmbedding() is called
   * 2. Traditional filters are applied
   * 3. Vector search finds similar names using MongoDB Atlas $vectorSearch
   * 4. Results are sorted and paginated
   *
   * The vector encoding happens in searchCasesWithVectorSearch() method below.
   */
  async searchCases(predicate: CasesSearchPredicate): Promise<CamsPaginationResponse<SyncedCase>> {
    try {
      if (predicate.includeOnlyUnassigned) {
        return await this.searchForUnassignedCases(predicate);
      }

      const conditions = this.addConditions(predicate);

      if (!hasRequiredSearchFields(predicate)) {
        throw new CamsError(MODULE_NAME, {
          message: 'Case Search requires a pagination predicate with a valid limit and offset',
        });
      }

      const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

      // Check if vector search is requested
      if (predicate.name && predicate.name.trim().length > 0) {
        this.context.logger.info(
          MODULE_NAME,
          `Vector search requested for name: "${predicate.name}"`,
        );
        return await this.searchCasesWithVectorSearch(predicate, conditions, dateFiled, caseNumber);
      }

      // Fall back to traditional search
      this.context.logger.debug(MODULE_NAME, 'Using traditional search (no name provided)');
      const spec = pipeline(
        match(and(...conditions)),
        sort(descending(dateFiled), descending(caseNumber)),
        paginate(predicate.offset, predicate.limit),
      );

      return await this.getAdapter<SyncedCase>().paginate(spec);
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve cases${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
          module: MODULE_NAME,
        },
      });
      throw error;
    }
  }

  /**
   * **VECTOR ENCODING HAPPENS HERE**
   *
   * This method demonstrates where predicate.name gets encoded to a vector:
   *
   * Step 1: Get EmbeddingService singleton
   * Step 2: Call generateEmbedding(context, predicate.name) -> Returns 384-dimensional vector
   * Step 3: Build pipeline with vectorSearch stage
   * Step 4: MongoAtlasAggregateRenderer converts pipeline to MongoDB $vectorSearch syntax
   *
   * The actual encoding occurs at line with "await embeddingService.generateEmbedding()"
   */
  private async searchCasesWithVectorSearch(
    predicate: CasesSearchPredicate,
    conditions: ConditionOrConjunction<SyncedCase>[],
    dateFiled: Field<SyncedCase>,
    caseNumber: Field<SyncedCase>,
  ): Promise<CamsPaginationResponse<SyncedCase>> {
    // Step 1: Get embedding service
    const embeddingService = getEmbeddingService();

    // Step 2: **ENCODING HAPPENS HERE** - Convert text to 384-dimensional vector
    this.context.logger.debug(MODULE_NAME, `Generating query vector for name: "${predicate.name}"`);
    const queryVector = await embeddingService.generateEmbedding(this.context, predicate.name);

    if (!queryVector) {
      this.context.logger.warn(
        MODULE_NAME,
        'Failed to generate query vector, falling back to traditional search',
      );
      // Fall back to traditional search
      const spec = pipeline(
        match(and(...conditions)),
        sort(descending(dateFiled), descending(caseNumber)),
        paginate(predicate.offset, predicate.limit),
      );
      return await this.getAdapter<SyncedCase>().paginate(spec);
    }

    this.context.logger.info(
      MODULE_NAME,
      `Query vector generated: ${queryVector.length} dimensions`,
    );

    // Step 3: Build pipeline with vector search stage
    // Strategy: Pre-filter with traditional conditions, then apply vector search
    const k = Math.max(predicate.limit * 2, 50); // Get more candidates for ranking

    const spec = pipeline(
      match(and(...conditions)), // Pre-filter with traditional conditions FIRST
      vectorSearch(queryVector, 'keywordsVector', k, 'COS'), // Cosine similarity search
      sort(descending(dateFiled), descending(caseNumber)),
      paginate(predicate.offset, predicate.limit),
    );

    this.context.logger.info(
      MODULE_NAME,
      `Vector search pipeline: ${conditions.length} filters, k=${k}, limit=${predicate.limit}`,
    );

    // Step 4: Adapter uses MongoAtlasAggregateRenderer to convert to $vectorSearch
    return await this.getAdapter<SyncedCase>().paginate(spec);
  }

  private async searchForUnassignedCases(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<SyncedCase>> {
    type TempFields = {
      allAssignments: CaseAssignment[];
      matchingAssignments: CaseAssignment[];
    };

    const { assignments: assignmentsPredicate, ...initialPredicate } = predicate;
    const initialMatch = and(...this.addConditions(initialPredicate));

    // Field references from the `assignments` collection.
    const assignmentDocs = source<CaseAssignment>('assignments');
    const [assignmentName, assignmentUnassignedOn] = assignmentDocs.fields('name', 'unassignedOn');

    // Field references from the `cases` collection.
    const caseDocs = source<SyncedCase>('cases');
    const assignmentsField = caseDocs.field('assignments');

    // Field references for the intermediate shape of the documents in the aggregation
    const [allAssignmentsTempField, matchingAssignmentsTempField] = source<TempFields>().fields(
      'allAssignments',
      'matchingAssignments',
    );
    const matchingAssignments = additionalField(
      matchingAssignmentsTempField,
      allAssignmentsTempField,
      predicate.assignments ? and(assignmentName.equals(predicate.assignments[0].name)) : and(),
    );

    const assignments = additionalField(
      assignmentsField,
      allAssignmentsTempField,
      assignmentUnassignedOn.notExists(),
    );

    const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

    const pipelineQuery = pipeline(
      match(initialMatch),
      join<CaseAssignment>(assignmentDocs.field('caseId'))
        .onto<SyncedCase>(caseDocs.field('caseId'))
        .as<TempFields>(allAssignmentsTempField),
      addFields(matchingAssignments, assignments),
      match(assignmentsField.equals([])),
      exclude(allAssignmentsTempField, matchingAssignmentsTempField),
      sort(descending(dateFiled), descending(caseNumber)),
      paginate(predicate.offset, predicate.limit),
    );

    return await this.getAdapter<SyncedCase>().paginate(pipelineQuery);
  }

  async getSyncedCase(caseId: string): Promise<SyncedCase> {
    const doc = using<SyncedCase>();
    const query = and(doc('caseId').equals(caseId), doc('documentType').equals('SYNCED_CASE'));
    try {
      return await this.getAdapter<SyncedCase>().findOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve synced case: ${caseId}`,
        },
      });
    }
  }
}
