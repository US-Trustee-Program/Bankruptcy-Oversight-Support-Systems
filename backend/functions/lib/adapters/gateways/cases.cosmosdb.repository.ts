import { ApplicationContext } from '../types/basic';
import { getCasesCosmosDbClient, getCosmosConfig } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { TransferIn, TransferOut } from '../../use-cases/orders/orders.model';
import { isPreExistingDocumentError } from './cosmos/cosmos.helper';
import { CasesRepository } from '../../use-cases/gateways.types';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';

export class CasesCosmosDbRepository implements CasesRepository {
  private cosmosDbClient;

  private containerName = 'cases';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getCasesCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferIn | TransferOut>> {
    // TODO: validate caseId
    const query = 'SELECT * FROM c WHERE c.caseId = @caseId';
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

  private async create<T>(context: ApplicationContext, itemToCreate: T): Promise<T> {
    try {
      try {
        const { item } = await this.cosmosDbClient
          .database(this.cosmosConfig.databaseName)
          .container(this.containerName)
          .items.create(itemToCreate);
        return item;
      } catch (e) {
        if (!isPreExistingDocumentError(e)) {
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
