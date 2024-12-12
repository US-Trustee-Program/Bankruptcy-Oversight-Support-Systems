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
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME: string = 'CASES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'cases';

const { and, equals, regex } = QueryBuilder;

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
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async create<T>(itemToCreate: T): Promise<T> {
    try {
      const adapter = this.getAdapter<T>();
      const id = await adapter.insertOne(itemToCreate);
      return { ...itemToCreate, id };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createTransferFrom(transferFrom: TransferFrom): Promise<TransferFrom> {
    try {
      return this.create<TransferFrom>(transferFrom);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to create transferFrom for: ${transferFrom.caseId}.`,
      );
    }
  }

  async createTransferTo(transferOut: TransferTo): Promise<TransferTo> {
    try {
      return this.create<TransferTo>(transferOut);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to create transferTo for: ${transferOut.caseId}.`,
      );
    }
  }

  async getConsolidation(caseId: string): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    const query = QueryBuilder.build(
      and(regex('documentType', '^CONSOLIDATION_'), equals<Transfer['caseId']>('caseId', caseId)),
    );
    try {
      const adapter = this.getAdapter<ConsolidationTo | ConsolidationFrom>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createConsolidationFrom(consolidationFrom: ConsolidationFrom): Promise<ConsolidationFrom> {
    try {
      return this.create<ConsolidationFrom>(consolidationFrom);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to create consolidationFrom for: ${consolidationFrom.caseId}.`,
      );
    }
  }

  async createConsolidationTo(consolidationOut: ConsolidationTo): Promise<ConsolidationTo> {
    try {
      return this.create<ConsolidationTo>(consolidationOut);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to create consolidationTo for: ${consolidationOut.caseId}.`,
      );
    }
  }

  async getCaseHistory(caseId: string): Promise<CaseHistory[]> {
    const query = QueryBuilder.build(
      and(regex('documentType', '^AUDIT_'), equals<Transfer['caseId']>('caseId', caseId)),
    );

    try {
      const adapter = this.getAdapter<CaseHistory>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createCaseHistory(history: CaseHistory) {
    try {
      await this.create<CaseHistory>(history);
      this.context.logger.debug(MODULE_NAME, `Created case history for: ${history.caseId}.`);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
      );
    }
  }
}
