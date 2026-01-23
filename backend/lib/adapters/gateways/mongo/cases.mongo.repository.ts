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
import {
  generatePhoneticTokensWithNicknames,
  isPhoneticSearchEnabled,
} from '../../../use-cases/cases/phonetic-utils';
// TODO: CAMS-376 - Remove these imports after database backfill is complete
import { shouldUseMockData, getMockPhoneticSearchCases } from './cases.mongo.repository.mock-data';

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

  async getAllCaseHistory(documentType: string): Promise<CaseHistory[]> {
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

    if (predicate.debtorName) {
      // Check if phonetic search is enabled in feature flags
      const phoneticEnabled = isPhoneticSearchEnabled(this.context?.featureFlags);

      if (phoneticEnabled) {
        // Phonetic search path: use phonetic tokens with nickname expansion
        const tokens = generatePhoneticTokensWithNicknames(predicate.debtorName);
        const debtorNameRegex = new RegExp(predicate.debtorName, 'i'); // case-insensitive

        // Combine phonetic token search with regex fallback for partial matches
        conditions.push(
          or(
            // Phonetic token matching
            doc('debtor.phoneticTokens').contains(tokens),
            doc('jointDebtor.phoneticTokens').contains(tokens),
            // Fallback to regex for partial matches
            doc('debtor.name').regex(debtorNameRegex),
            doc('jointDebtor.name').regex(debtorNameRegex),
          ),
        );
      } else {
        // Existing regex-only path (unchanged)
        const debtorNameRegex = new RegExp(predicate.debtorName, 'i'); // case-insensitive
        conditions.push(
          or(
            doc('debtor.name').regex(debtorNameRegex),
            doc('jointDebtor.name').regex(debtorNameRegex),
          ),
        );
      }
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
      // TODO: CAMS-376 - Remove this entire block after database backfill is complete
      // DEVELOPMENT MOCK: Return mock data if MOCK_PHONETIC_SEARCH_DATA=true
      // This is a temporary workaround because existing cases don't have phoneticTokens
      if (shouldUseMockData()) {
        const mockCases = getMockPhoneticSearchCases();
        this.context.logger.warn(
          MODULE_NAME,
          `[DEV MOCK] Using ${mockCases.length} mock cases for phonetic search testing. Set MOCK_PHONETIC_SEARCH_DATA=false to use real database.`,
        );
        return {
          metadata: { total: mockCases.length },
          data: mockCases,
        };
      }
      // END TODO: CAMS-376

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
          message: `Failed to retrieve member consolidations${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
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

  public async updateManyByQuery<T>(query: ConditionOrConjunction<T>, update: unknown) {
    try {
      return await this.getAdapter<T>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
