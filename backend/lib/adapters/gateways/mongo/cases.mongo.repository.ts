import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '@common/cams/events';
import { ApplicationContext } from '../../types/basic';
import { CaseHistory } from '@common/cams/history';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import { CamsPaginationResponse, CasesRepository } from '../../../use-cases/gateways.types';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { SyncedCase } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsError } from '../../../common-errors/cams-error';
import QueryPipeline from '../../../query/query-pipeline';
import { CaseAssignment } from '@common/cams/assignments';
import { getEmbeddingService } from '../../services/embedding.service';

const MODULE_NAME = 'CASES-MONGO-REPOSITORY';
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

export class CasesMongoRepository extends BaseMongoRepository implements CasesRepository {
  private static referenceCount: number = 0;
  private static instance: CasesMongoRepository;
  private context: ApplicationContext;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
  }

  public static getInstance(context: ApplicationContext) {
    if (!CasesMongoRepository.instance) {
      CasesMongoRepository.instance = new CasesMongoRepository(context);
    }
    CasesMongoRepository.referenceCount++;
    return CasesMongoRepository.instance;
  }

  public static dropInstance() {
    if (CasesMongoRepository.referenceCount > 0) {
      CasesMongoRepository.referenceCount--;
    }
    if (CasesMongoRepository.referenceCount < 1) {
      CasesMongoRepository.instance?.client?.close().then();
      CasesMongoRepository.instance = null;
    }
  }

  public release() {
    CasesMongoRepository.dropInstance();
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

  async searchCases(predicate: CasesSearchPredicate): Promise<CamsPaginationResponse<SyncedCase>> {
    try {
      if (predicate.includeOnlyUnassigned) {
        return await this.searchForUnassignedCases(predicate);
      }

      // Use vector search if name is provided
      if (predicate.name && predicate.name.trim().length > 0) {
        return await this.searchCasesWithVectorSearch(predicate);
      }

      // Traditional search without vector similarity
      const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

      const conditions = this.addConditions(predicate);

      if (!hasRequiredSearchFields(predicate)) {
        throw new CamsError(MODULE_NAME, {
          message: 'Case Search requires a pagination predicate with a valid limit and offset',
        });
      }

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
   * Search cases using vector similarity for fuzzy name matching.
   * Uses hybrid approach: traditional filters first, then vector search.
   */
  private async searchCasesWithVectorSearch(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<SyncedCase>> {
    if (!hasRequiredSearchFields(predicate)) {
      throw new CamsError(MODULE_NAME, {
        message: 'Case Search requires a pagination predicate with a valid limit and offset',
      });
    }

    try {
      const embeddingService = getEmbeddingService();

      // Generate embedding vector for the search name
      this.context.logger.debug(MODULE_NAME, `Generating embedding for name: ${predicate.name}`);
      const queryVector = await embeddingService.generateEmbedding(this.context, predicate.name);

      if (!queryVector) {
        this.context.logger.warn(
          MODULE_NAME,
          `Failed to generate embedding for name: ${predicate.name}, falling back to traditional search`,
        );
        // Fall back to traditional search without name
        const { name, ...predicateWithoutName } = predicate;
        return await this.searchCases(predicateWithoutName);
      }

      // Build traditional match conditions using the existing helper
      const conditions = this.addConditions(predicate);

      // Get field references for sorting
      const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

      // Determine k (number of results to retrieve from vector search)
      // Use 2x the requested limit to allow for better ranking
      const k = Math.min(predicate.limit * 2, 100);

      this.context.logger.debug(
        MODULE_NAME,
        `Vector search with k=${k}, offset=${predicate.offset}, limit=${predicate.limit}`,
      );

      // Build pipeline using query builder pattern
      // NOTE: $search must be the first stage in Cosmos DB aggregation pipeline
      const spec = pipeline(
        vectorSearch(queryVector, 'keywordsVector', k), // Vector similarity search (MUST be first)
        match(and(...conditions)), // Then filter with traditional conditions
        sort(descending(dateFiled), descending(caseNumber)), // Sort by dateFiled, then caseNumber
        paginate(predicate.offset, predicate.limit), // Apply pagination
      );

      return await this.getAdapter<SyncedCase>().paginate(spec);
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to perform vector search for name: ${predicate.name}`,
          module: MODULE_NAME,
        },
      });
      throw error;
    }
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
