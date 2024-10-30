import {
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../../common/src/cams/events';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import { ApplicationContext } from '../types/basic';
import { CaseHistory } from '../../../../../common/src/cams/history';
import QueryBuilder from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { CasesRepository } from '../../use-cases/gateways.types';
import { getCamsError } from '../../common-errors/error-utilities';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';
const COLLECTION_NAME = 'cases';

const { and, equals, regex } = QueryBuilder;

export class CasesCosmosMongoDbRepository implements CasesRepository {
  private readonly client: DocumentClient;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(context, this.client);
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }

  async getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>> {
    const query = QueryBuilder.build(
      and(regex('documentType', '^TRANSFER_'), equals<Transfer['caseId']>('caseId', caseId)),
    );
    const adapter = this.getAdapter<Transfer>();
    const result = await adapter.find(query);

    const transfers: Transfer[] = [];
    for await (const doc of result) {
      transfers.push(doc);
    }
    return transfers;
  }

  private async create<T>(itemToCreate: T): Promise<T> {
    try {
      const adapter = this.getAdapter<T>();
      const id = await adapter.insertOne(itemToCreate);
      return { ...itemToCreate, id };
    } catch (originalError) {
      // if (!isPreExistingDocumentError(originalError)) {
      //   throw new BadRequestError(MODULE_NAME, {
      //     message: 'Item already exists',
      //   });
      // }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async createTransferFrom(transferFrom: TransferFrom): Promise<TransferFrom> {
    return this.create<TransferFrom>(transferFrom);
  }

  async createTransferTo(transferOut: TransferTo): Promise<TransferTo> {
    return this.create<TransferTo>(transferOut);
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
    return this.create<ConsolidationFrom>(consolidationFrom);
  }

  async createConsolidationTo(consolidationOut: ConsolidationTo): Promise<ConsolidationTo> {
    return this.create<ConsolidationTo>(consolidationOut);
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
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
      );
    }
  }
}
