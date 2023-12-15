import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CaseAssignmentHistory } from '../types/case.assignment';
import { CaseHistoryGateway } from '../../use-cases/gateways.types';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_HISTORY';

export class CaseHistoryCosmosDbRepository implements CaseHistoryGateway {
  private cosmosDbClient;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext, testClient = false) {
    this.cosmosDbClient = getCosmosDbClient(applicationContext, testClient);
    this.cosmosConfig = getCosmosConfig(applicationContext);
  }

  async getCaseAssignmentHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignmentHistory[]> {
    const query =
      'SELECT * FROM c WHERE c.documentType = "ASSIGNMENT_HISTORY" AND c.caseId = @caseId';
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
      ],
    };
    const response = await this.queryData(context, querySpec);
    return response;
  }

  private async queryData(
    context: ApplicationContext,
    querySpec: object,
  ): Promise<CaseAssignmentHistory[]> {
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(querySpec)
        .fetchAll();
      return results;
    } catch (e) {
      log.error(context, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      }
    }
  }
}
