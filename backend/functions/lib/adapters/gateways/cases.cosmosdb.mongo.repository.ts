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
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';
import { DocumentQuery } from './document-db.repository';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';

export class CasesCosmosMongoDbRepository {
  private documentClient: DocumentClient;
  private containerName = 'cases';

  constructor(connectionString: string) {
    this.documentClient = new DocumentClient(connectionString);
  }

  async getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferFrom | TransferTo>> {
    const query: DocumentQuery = {
      and: [{ documentType: { $regex: '^TRANSFER_' } }, { caseId: { equals: caseId } }],
    };
    const result = await this.documentClient
      .database('cams')
      .collection<Transfer>(this.containerName)
      .find(query);

    const transfers: Transfer[] = [];

    for await (const doc of result) {
      transfers.push(doc);
    }
    context.logger.info(MODULE_NAME, 'Got:', transfers);
    await this.documentClient.close();

    return transfers;
  }

  private async create<T>(context: ApplicationContext, itemToCreate: T): Promise<T> {
    try {
      try {
        const resource = await this.documentClient
          .database('cams')
          .collection<T>(this.containerName)
          .insertOne(itemToCreate);
        context.logger.info(MODULE_NAME, 'Created the following resource:', resource);
        return itemToCreate;
      } catch (e) {
        if (!isPreExistingDocumentError(e)) {
          context.logger.info(MODULE_NAME, 'Item already exists: ', itemToCreate);
          throw e;
        }
      }
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError,
        });
      } else {
        throw originalError;
      }
    }
    await this.documentClient.close();
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
    const query: DocumentQuery = {
      and: [{ documentType: { $regex: '^CONSOLIDATION_' } }, { caseId: { equals: caseId } }],
    };
    const result = await this.documentClient
      .database('cams')
      .collection<Consolidation>(this.containerName)
      .find(query);
    const consolidations: Consolidation[] = [];

    for await (const doc of result) {
      consolidations.push(doc);
    }
    context.logger.info(MODULE_NAME, 'Created the following resource:', consolidations);
    await this.documentClient.close();

    return consolidations;
  }

  async createConsolidationTo(
    context: ApplicationContext,
    consolidationIn: ConsolidationTo,
  ): Promise<ConsolidationTo> {
    return this.create<ConsolidationTo>(context, consolidationIn);
  }

  async createConsolidationFrom(
    context: ApplicationContext,
    consolidationOut: ConsolidationFrom,
  ): Promise<ConsolidationFrom> {
    return this.create<ConsolidationFrom>(context, consolidationOut);
  }

  async getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]> {
    const query: DocumentQuery = {
      and: [{ documentType: { $regex: '^AUDIT_' } }, { caseId: { equals: caseId } }],
    };
    const result = await this.documentClient
      .database('cams')
      .collection<CaseHistory>(this.containerName)
      .find(query);

    const history: CaseHistory[] = [];

    for await (const doc of result) {
      history.push(doc);
    }
    context.logger.info(MODULE_NAME, 'Created the following resource:', history);

    return history;
  }

  async createCaseHistory(context: ApplicationContext, history: CaseHistory): Promise<string> {
    try {
      const result = await this.create<CaseHistory>(context, history);

      context.logger.debug(MODULE_NAME, `New history created ${result.id}`);
      await this.documentClient.close();

      return result.id;
    } catch (e) {
      context.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      throw new UnknownError(MODULE_NAME, {
        message:
          'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
        originalError: e,
        status: 500,
      });
    }
  }

  //   private async queryData<T>(context: ApplicationContext, querySpec: object): Promise<T[]> {
  //     try {
  //       const { resources: results } = await this.cosmosDbClient
  //         .database(this.cosmosConfig.databaseName)
  //         .container(this.containerName)
  //         .items.query(querySpec)
  //         .fetchAll();
  //       return results;
  //     } catch (originalError) {
  //       context.logger.error(
  //         MODULE_NAME,
  //         `${originalError.status} : ${originalError.name} : ${originalError.message}`,
  //       );
  //       if (originalError instanceof AggregateAuthenticationError) {
  //         throw new ServerConfigError(MODULE_NAME, {
  //           message: 'Failed to authenticate to Azure',
  //           originalError: originalError,
  //         });
  //       } else {
  //         throw originalError;
  //       }
  //     }
  //   }
  async close() {
    this.documentClient.close();
  }
}
