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
  Pagination,
  Query,
  Sort,
} from '../../../query/query-builder';
import { CasesRepository } from '../../../use-cases/gateways.types';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { SyncedCase } from '../../../../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../../../../common/src/api/search';
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME: string = 'CASES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'cases';

const { paginate, and, or, equals, regex, contains, notContains } = QueryBuilder;

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
    try {
      const query = QueryBuilder.build(
        and(regex('documentType', '^TRANSFER_'), equals<Transfer['caseId']>('caseId', caseId)),
      );
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
    try {
      const query = QueryBuilder.build(
        and(regex('documentType', '^CONSOLIDATION_'), equals<Transfer['caseId']>('caseId', caseId)),
      );
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
    try {
      const query = QueryBuilder.build(
        and(regex('documentType', '^AUDIT_'), equals<Transfer['caseId']>('caseId', caseId)),
      );
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
    const query = QueryBuilder.build(
      and(
        equals<SyncedCase['caseId']>('caseId', bCase.caseId),
        equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'),
      ),
    );
    try {
      await this.getAdapter<SyncedCase>().replaceOne(query, bCase, true);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async deleteSyncedCases(): Promise<void> {
    try {
      const adapter = this.getAdapter<SyncedCase>();
      const existingQuery = QueryBuilder.build(
        equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'),
      );
      const existingCount = await adapter.countDocuments(existingQuery);
      let deletedCount = 0;
      const limit = 10;
      let offset = 0;
      while (existingCount > deletedCount) {
        const predicate: CasesSearchPredicate = { limit, offset };
        const page = await this.searchCases(predicate);
        const caseIds = page.data.map((bCase) => bCase.caseId);
        const deleteQuery = QueryBuilder.build(
          and(
            equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'),
            contains<SyncedCase['caseId']>('caseId', caseIds),
          ),
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
    try {
      // equals<string>('otherCase.status', 'approved'), this is in the data but i can find a reference anywhere in the code to this

      const conditions: ConditionOrConjunction[] = [];
      conditions.push(equals<string>('documentType', 'CONSOLIDATION_TO'));

      if (predicate.caseIds?.length > 0) {
        conditions.push(contains<SyncedCase['caseId']>('caseId', predicate.caseIds));
      }

      if (predicate.divisionCodes?.length > 0) {
        const matchers: ConditionOrConjunction[] = [];
        predicate.divisionCodes.forEach((code) => {
          matchers.push(regex('caseId', `^${code}`));
        });
        conditions.push(or(...matchers));
      }
      const query = QueryBuilder.build(and(...conditions));

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

  async searchCases(predicate: CasesSearchPredicate) {
    const conditions: ConditionOrConjunction[] = [];
    conditions.push(equals<SyncedCase['documentType']>('documentType', 'SYNCED_CASE'));
    let subQuery: Query;
    try {
      if (predicate.caseNumber) {
        conditions.push(equals<SyncedCase['caseNumber']>('caseNumber', predicate.caseNumber));
      }

      ///TODO: we repeat very similar logic in the function above. We should be able to extract the conditions to
      if (predicate.caseIds) {
        conditions.push(contains<SyncedCase['caseId']>('caseId', predicate.caseIds));
      }

      if (predicate.chapters?.length > 0) {
        conditions.push(contains<SyncedCase['chapter']>('chapter', predicate.chapters));
      }

      if (predicate.divisionCodes?.length > 0) {
        conditions.push(
          contains<SyncedCase['courtDivisionCode']>('courtDivisionCode', predicate.divisionCodes),
        );
      }

      if (predicate.excludeChildConsolidations === true && predicate.excludedCaseIds?.length > 0) {
        conditions.push(notContains<SyncedCase['caseId']>('caseId', predicate.excludedCaseIds));
      }

      if (predicate.limit && predicate.offset >= 0) {
        const sortSpec: Sort = {
          attributes: [
            ['dateFiled', 'DESCENDING'],
            ['caseNumber', 'DESCENDING'],
          ],
        };

        //If we don't have this we have a problem
        subQuery = paginate(predicate.offset, predicate.limit, [and(...conditions)], sortSpec);
        const query = QueryBuilder.build<Pagination>(subQuery);
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
