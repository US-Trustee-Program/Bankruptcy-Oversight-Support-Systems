import { AggregateAuthenticationError } from '@azure/identity';
import {
  Consolidation,
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../../common/src/cams/events';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { ApplicationContext } from '../types/basic';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { UnknownError } from '../../common-errors/unknown-error';
import { toMongoQuery } from '../../query/mongo-query-renderer';
import QueryBuilder from '../../query/query-builder';
import { Closable, deferClose } from '../../defer-close';
// import { BadRequestError } from '../../common-errors/bad-request';
import { CasesRepository } from '../../use-cases/gateways.types';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';

const { and, equals, regex } = QueryBuilder;

export class CasesCosmosMongoDbRepository implements Closable, CasesRepository {
  private documentClient: DocumentClient;
  private readonly containerName = 'cases';

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.documentDbConfig.connectionString);
    deferClose(context, this);
  }

  async getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferFrom | TransferTo>> {
    const query = QueryBuilder.build(
      toMongoQuery,
      and(regex('documentType', '^TRANSFER_'), equals<Transfer['caseId']>('caseId', caseId)),
    );
    const result = await this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<Transfer>(this.containerName)
      .find(query);

    const transfers: Transfer[] = [];
    for await (const doc of result) {
      transfers.push(doc);
    }
    return transfers;
  }

  private async create<T>(context: ApplicationContext, itemToCreate: T): Promise<T> {
    try {
      await this.documentClient
        .database(context.config.documentDbConfig.databaseName)
        .collection<T>(this.containerName)
        .insertOne(itemToCreate);
      return itemToCreate;
    } catch (originalError) {
      // if (!isPreExistingDocumentError(originalError)) {
      //   throw new BadRequestError(MODULE_NAME, {
      //     message: 'Item already exists',
      //   });
      // }
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
  }

  async createTransferFrom(
    context: ApplicationContext,
    transferFrom: TransferFrom,
  ): Promise<TransferFrom> {
    return this.create<TransferFrom>(context, transferFrom);
  }

  async createTransferTo(
    context: ApplicationContext,
    transferOut: TransferTo,
  ): Promise<TransferTo> {
    return this.create<TransferTo>(context, transferOut);
  }

  async getConsolidation(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    const query = QueryBuilder.build(
      toMongoQuery,
      and(regex('documentType', '^CONSOLIDATION_'), equals<Transfer['caseId']>('caseId', caseId)),
    );
    const result = await this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<Consolidation>(this.containerName)
      .find(query);
    const consolidations: Consolidation[] = [];

    for await (const doc of result) {
      consolidations.push(doc);
    }
    return consolidations;
  }

  async createConsolidationFrom(
    context: ApplicationContext,
    consolidationFrom: ConsolidationFrom,
  ): Promise<ConsolidationFrom> {
    return this.create<ConsolidationFrom>(context, consolidationFrom);
  }

  async createConsolidationTo(
    context: ApplicationContext,
    consolidationOut: ConsolidationTo,
  ): Promise<ConsolidationTo> {
    return this.create<ConsolidationTo>(context, consolidationOut);
  }

  async getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]> {
    const query = QueryBuilder.build(
      toMongoQuery,
      and(regex('documentType', '^AUDIT_'), equals<Transfer['caseId']>('caseId', caseId)),
    );
    const result = await this.documentClient
      .database(context.config.documentDbConfig.databaseName)
      .collection<CaseHistory>(this.containerName)
      .find(query);

    const history: CaseHistory[] = [];

    for await (const doc of result) {
      history.push(doc);
    }
    return history;
  }

  async createCaseHistory(context: ApplicationContext, history: CaseHistory): Promise<string> {
    try {
      const result = await this.create<CaseHistory>(context, history);

      return result.id;
    } catch (e) {
      throw new UnknownError(MODULE_NAME, {
        message:
          'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
        originalError: e,
        status: 500,
      });
    }
  }

  async close() {
    await this.documentClient.close();
  }
}
