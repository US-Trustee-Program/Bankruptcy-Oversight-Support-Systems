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
import {
  CamsPaginationResponse,
  CaseHistoryDocumentType,
  CasesRepository,
} from '../../../use-cases/gateways.types';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { SyncedCase } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsError } from '../../../common-errors/cams-error';
import QueryPipeline, {
  DEFAULT_BIGRAM_WEIGHT,
  DEFAULT_NICKNAME_WEIGHT,
  DEFAULT_PHONETIC_WEIGHT,
} from '../../../query/query-pipeline';
import { CaseAssignment } from '@common/cams/assignments';
import { generateQueryTokensWithNicknames } from '../../utils/phonetic-helper';

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
  score,
  sort,
  source,
} = QueryPipeline;

// Type augmentation for MongoDB queries - allows dot-notation paths
// This enables type-safe access to nested fields in MongoDB queries
// without modifying the actual SyncedCase data structure
type SyncedCaseQueryable = SyncedCase & {
  'debtor.phoneticTokens'?: string[];
  'jointDebtor.phoneticTokens'?: string[];
};

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

  async getAllCaseHistory(documentType: CaseHistoryDocumentType): Promise<CaseHistory[]> {
    const doc = using<CaseHistory>();
    try {
      const query = doc('documentType').equals(documentType);
      const adapter = this.getAdapter<CaseHistory>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to get all case history for document type ${documentType}.`,
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

  async updateCaseHistory(history: CaseHistory): Promise<void> {
    const doc = using<CaseHistory>();
    try {
      const query = doc('id').equals(history.id);
      await this.getAdapter<CaseHistory>().replaceOne(query, history);
      this.context.logger.debug(MODULE_NAME, `Updated case history for: ${history.caseId}.`);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message:
            'Unable to update case history. Please try again later. If the problem persists, please contact USTP support.',
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
   * Searches cases using phonetic token matching with nickname expansion for debtor name similarity.
   *
   * This method generates search tokens (bigrams and phonetic codes) and nickname tokens from the
   * search query and matches them against pre-computed tokens stored on case documents.
   * Results are scored based on token overlap, filtered to require at least one bigram match,
   * and sorted by match score (descending), then by date filed and case number.
   *
   * Scoring weights:
   * - Bigram matches: 3 points each (character-level similarity, typo tolerance)
   * - Phonetic code matches: 11 points each (sound-based similarity via Soundex/Metaphone)
   * - Nickname matches: 10 points each (name variations like "Mike" → "Michael")
   *
   * Filtering:
   * - Requires at least one bigram match to prevent phonetic-only false positives
   * - Matches on both debtor and jointDebtor phonetic tokens
   *
   * Falls back to regular searchCases when no debtorName is provided.
   *
   * @param predicate - Search criteria including debtorName for phonetic matching
   * @returns Paginated cases sorted by phonetic match score (highest relevance first)
   */
  async searchCasesWithPhoneticTokens(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<SyncedCase>> {
    try {
      if (!predicate.debtorName) {
        return this.searchCases(predicate);
      }

      if (!hasRequiredSearchFields(predicate)) {
        throw new CamsError(MODULE_NAME, {
          message: 'Case Search requires a pagination predicate with a valid limit and offset',
        });
      }

      const { searchTokens, nicknameTokens } = generateQueryTokensWithNicknames(
        predicate.debtorName,
      );
      const allTokens = [...searchTokens, ...nicknameTokens];
      if (allTokens.length === 0) {
        return { metadata: { total: 0 }, data: [] };
      }

      const doc = using<SyncedCaseQueryable>();
      const conditions = this.addConditions(predicate);

      conditions.push(
        or(
          doc('debtor.phoneticTokens').contains(allTokens),
          doc('jointDebtor.phoneticTokens').contains(allTokens),
        ),
      );

      const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

      const spec = pipeline(
        match(and(...conditions)),
        score(
          searchTokens,
          nicknameTokens,
          ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
          'matchScore',
          DEFAULT_BIGRAM_WEIGHT,
          DEFAULT_PHONETIC_WEIGHT,
          DEFAULT_NICKNAME_WEIGHT,
        ),
        match(
          using<SyncedCase & { bigramMatchCount: number }>()('bigramMatchCount').greaterThan(0),
        ),
        sort(descending({ name: 'matchScore' }), descending(dateFiled), descending(caseNumber)),
        paginate(predicate.offset, predicate.limit),
      );

      return await this.getAdapter<SyncedCase>().paginate(spec);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to search cases with hybrid scoring for "${predicate.debtorName}".`,
          module: MODULE_NAME,
        },
      });
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

  public async updateManyByQuery<T>(query: ConditionOrConjunction<T>, update: unknown) {
    try {
      return await this.getAdapter<T>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
