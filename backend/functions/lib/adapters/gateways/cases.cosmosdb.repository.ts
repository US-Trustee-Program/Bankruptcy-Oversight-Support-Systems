import { ApplicationContext } from '../types/basic';
import { getCosmosDbClient, getCosmosConfig } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { TransferIn, TransferOut } from '../../../../../common/src/cams/events';
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';
import { CasesRepository } from '../../use-cases/gateways.types';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseHistory } from '../../../../../common/src/cams/history';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';

export class CasesCosmosDbRepository implements CasesRepository {
  private cosmosDbClient;

  private containerName = 'cases';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferIn | TransferOut>> {
    const query = "SELECT * FROM c WHERE c.caseId = @caseId AND c.documentType LIKE 'TRANSFER_%'";
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
      ],
    };
    const response = await this.queryData<TransferIn | TransferOut>(context, querySpec);
    return response;
  }

  async createTransferIn(context: ApplicationContext, transferIn: TransferIn): Promise<TransferIn> {
    return this.create<TransferIn>(context, transferIn);
  }

  async createTransferOut(
    context: ApplicationContext,
    transferOut: TransferOut,
  ): Promise<TransferOut> {
    return this.create<TransferOut>(context, transferOut);
  }

  async getCaseHistory(context: ApplicationContext, caseId: string): Promise<Array<CaseHistory>> {
    const query =
      'SELECT * FROM c WHERE c.documentType LIKE "AUDIT_%" AND c.caseId = @caseId ORDER BY c.occurredAtTimestamp DESC';
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
      ],
    };
    const response = await this.queryData<CaseHistory>(context, querySpec);
    return response;
  }

  async createCaseHistory(context: ApplicationContext, history: CaseHistory): Promise<string> {
    try {
      if (!history.occurredAtTimestamp) {
        history.occurredAtTimestamp = new Date().toISOString();
      }
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(history);
      context.logger.debug(MODULE_NAME, `New history created ${resource.id}`);
      return resource.id;
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

  private async create<T>(context: ApplicationContext, itemToCreate: T): Promise<T> {
    try {
      try {
        const { resource } = await this.cosmosDbClient
          .database(this.cosmosConfig.databaseName)
          .container(this.containerName)
          .items.create(itemToCreate);
        context.logger.info(MODULE_NAME, 'Created the following resource:', resource);
        return resource;
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
  }

  private async queryData<T>(context: ApplicationContext, querySpec: object): Promise<Array<T>> {
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(querySpec)
        .fetchAll();
      return results;
    } catch (originalError) {
      context.logger.error(
        MODULE_NAME,
        `${originalError.status} : ${originalError.name} : ${originalError.message}`,
      );
      if (originalError instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: originalError,
        });
      } else {
        throw originalError;
      }
    }
  }
}
