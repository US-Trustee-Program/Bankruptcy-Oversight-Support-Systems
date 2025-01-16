import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../../common/src/cams/events';
import { ApplicationContext } from '../../types/basic';
import { CaseHistory } from '../../../../../common/src/cams/history';
import QueryBuilder from '../../../query/query-builder';
import { CasesRepository } from '../../../use-cases/gateways.types';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { ACMS_SYSTEM_USER_REFERENCE, Auditable } from '../../../../../common/src/cams/auditable';

const MODULE_NAME: string = 'CASES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'cases';

const { and, or, equals, regex, contains } = QueryBuilder;

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

  async getConsolidationChildCases(caseIds: string[]): Promise<Map<string, ConsolidationTo>> {
    try {
      const query = QueryBuilder.build(
        and(
          // equals<string>('otherCase.status', 'approved'), this is in the data but i can find a reference anywhere in the code to this
          equals<string>('documentType', 'CONSOLIDATION_TO'),
          contains<string[]>('caseId', caseIds),
        ),
      );
      const adapter = this.getAdapter<ConsolidationTo>();
      const consolidations = await adapter.find(query);

      const consolidationsMap = new Map();
      consolidations.forEach((consolidation) => {
        if (caseIds.includes(consolidation.caseId)) {
          consolidationsMap.set(consolidation.caseId, consolidation);
        }
      });
      return consolidationsMap;
    } catch (originalError) {
      const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve consolidations for ${caseIds.join(', ')}.`,
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
        and(regex('documentType', '^AUDIT_'), equals<CaseHistory['caseId']>('caseId', caseId)),
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

  async deleteMigrations(): Promise<void> {
    try {
      const adapter = this.getAdapter<Auditable>();
      const query = QueryBuilder.build(
        or(
          equals<Auditable['updatedBy']>('updatedBy', ACMS_SYSTEM_USER_REFERENCE),
          equals<ConsolidationFrom['documentType']>('documentType', 'CONSOLIDATION_FROM'),
          equals<ConsolidationTo['documentType']>('documentType', 'CONSOLIDATION_TO'),
        ),
      );
      const count = await adapter.deleteMany(query);
      this.context.logger.info(MODULE_NAME, `Deleted ${count} migration records.`);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: 'Failed while deleting migrations.',
          module: MODULE_NAME,
        },
      });
    }
  }
}
