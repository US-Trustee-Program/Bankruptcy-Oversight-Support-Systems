import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../../common/src/cams/events';
import { ApplicationContext } from '../../types/basic';
import { CaseHistory } from '../../../../../common/src/cams/history';
import QueryBuilder, {
  ConditionOrConjunction,
  Query,
  Sort,
  using,
} from '../../../query/query-builder';
import { CasesRepository } from '../../../use-cases/gateways.types';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { SyncedCase } from '../../../../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../../../../common/src/api/search';
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME: string = 'CASES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'cases';

const { paginate, and, or } = QueryBuilder;

export class CasesMongoRepository extends BaseMongoRepository implements CasesRepository {
  private static referenceCount: number = 0;
  private static instance: CasesMongoRepository;
  private context: ApplicationContext;

  private constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
  }

  public static getInstance(context: ApplicationContext) {
    if (!CasesMongoRepository.instance)
      CasesMongoRepository.instance = new CasesMongoRepository(context);
    CasesMongoRepository.referenceCount++;
    return CasesMongoRepository.instance;
  }

  public static dropInstance() {
    if (CasesMongoRepository.referenceCount > 0) CasesMongoRepository.referenceCount--;
    if (CasesMongoRepository.referenceCount < 1) {
      CasesMongoRepository.instance.client.close().then();
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
            'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
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

  async deleteSyncedCases(): Promise<void> {
    const doc = using<SyncedCase>();
    try {
      const adapter = this.getAdapter<SyncedCase>();
      const existingQuery = doc('documentType').equals('SYNCED_CASE');
      const existingCount = await adapter.countDocuments(existingQuery);
      let deletedCount = 0;
      const limit = 10;
      let offset = 0;
      while (existingCount > deletedCount) {
        const predicate: CasesSearchPredicate = { limit, offset };
        const page = await this.searchCases(predicate);
        const caseIds = page.data.map((bCase) => bCase.caseId);
        const deleteQuery = and(
          doc('documentType').equals('SYNCED_CASE'),
          doc('caseId').contains(caseIds),
        );
        const deleted = await adapter.deleteMany(deleteQuery);
        offset += limit;
        deletedCount += deleted;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getConsolidationChildCaseIds(predicate: CasesSearchPredicate): Promise<string[]> {
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
      const childConsolidations = await adapter.find(query);

      const childConsolidationCaseIds: string[] = [];
      if (childConsolidations.length > 0) {
        for (const consolidationTo of childConsolidations) {
          childConsolidationCaseIds.push(consolidationTo.caseId);
        }
      }
      return childConsolidationCaseIds;
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve child consolidations${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
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

    ///TODO: we repeat very similar logic in the function above. We should be able to extract the conditions to
    if (predicate.caseIds) {
      conditions.push(doc('caseId').contains(predicate.caseIds));
    }

    if (predicate.chapters?.length > 0) {
      conditions.push(doc('chapter').contains(predicate.chapters));
    }

    if (predicate.divisionCodes?.length > 0) {
      conditions.push(doc('courtDivisionCode').contains(predicate.divisionCodes));
    }

    if (predicate.excludeChildConsolidations === true && predicate.excludedCaseIds?.length > 0) {
      conditions.push(doc('caseId').notContains(predicate.excludedCaseIds));
    }
    //NOTE: We only want cases that do not have a closed date, or they have a reopened date more recent than closed date
    if (predicate.excludeClosedCases === true) {
      conditions.push(
        or(
          doc('closedDate').notExists(),
          and(
            doc('closedDate').exists(),
            doc('reopenedDate').exists(),
            doc('reopenedDate').greaterThanOrEqual({ field: 'closedDate' }),
          ),
        ),
      );
    }
    return conditions;
  }

  async searchCases(predicate: CasesSearchPredicate) {
    const doc = using<SyncedCase>();
    const conditions: ConditionOrConjunction<SyncedCase>[] = [];
    conditions.push(doc('documentType').equals('SYNCED_CASE'));
    let query: Query<SyncedCase>;
    try {
      const conditions = this.addConditions(predicate);

      if (predicate.limit && predicate.offset >= 0) {
        const sortSpec: Sort<SyncedCase> = {
          attributes: [
            ['dateFiled', 'DESCENDING'],
            ['caseNumber', 'DESCENDING'],
          ],
        };

        //If we don't have this we have a problem
        query = paginate<SyncedCase>(
          predicate.offset,
          predicate.limit,
          [and(...conditions)],
          sortSpec,
        );
        return await this.getAdapter<SyncedCase>().paginatedFind(query);
      } else {
        throw new CamsError(MODULE_NAME, {
          message: 'Case Search requires a pagination predicate with a valid limit and offset',
        });
      }
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve child consolidations${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
          module: MODULE_NAME,
        },
      });
      throw error;
    }
  }
}
