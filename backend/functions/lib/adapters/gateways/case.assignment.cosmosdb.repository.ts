import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CaseAssignment, CaseAssignmentHistory } from '../types/case.assignment';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';

export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;
  private applicationContext: ApplicationContext;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
    this.applicationContext = applicationContext;
  }

  async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    try {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(caseAssignment);
      log.debug(this.applicationContext, MODULE_NAME, `New item created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.applicationContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e.status === 403) {
        throw new ForbiddenError(MODULE_NAME, {
          message:
            'Unable to create assignment. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      } else {
        throw new UnknownError(MODULE_NAME, {
          message:
            'Unable to create assignment. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      }
    }
  }

  async createAssignmentHistory(history: CaseAssignmentHistory): Promise<string> {
    try {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(history);
      log.debug(this.applicationContext, MODULE_NAME, `New history created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.applicationContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e.status === 403) {
        throw new ForbiddenError(MODULE_NAME, {
          message:
            'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      } else {
        throw new UnknownError(MODULE_NAME, {
          message:
            'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      }
    }
  }

  async updateAssignment(caseAssignment: CaseAssignment): Promise<string> {
    try {
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(caseAssignment.id)
        .replace(caseAssignment);
      log.debug(this.applicationContext, MODULE_NAME, `Assignment updated ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.applicationContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e.status === 403) {
        throw new ForbiddenError(MODULE_NAME, {
          message:
            'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      } else {
        throw new UnknownError(MODULE_NAME, {
          message:
            'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
          originalError: e,
          status: 500,
        });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAssignment(assignmentId: string): Promise<CaseAssignment> {
    throw new Error('Method not implemented.');
  }

  async getAssignmentHistory(caseId: string): Promise<CaseAssignmentHistory[]> {
    const query =
      'SELECT * FROM c WHERE c.documentType = "ASSIGNMENT_HISTORY" AND c.caseId = @caseId ORDER BY c.occurredAtTimestamp DESC';
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
        {
          name: '@documentType',
          value: 'ASSIGNMENT_HISTORY',
        },
      ],
    };
    const response = await this.queryData(querySpec);
    return response as CaseAssignmentHistory[];
  }

  async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    const query =
      'SELECT * FROM c WHERE c.documentType = "ASSIGNMENT" AND c.caseId = @caseId AND NOT IS_DEFINED(c.unassignedOn)';
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
        {
          name: '@documentType',
          value: 'ASSIGNMENT',
        },
      ],
    };
    const response = await this.queryData(querySpec);
    return response as CaseAssignment[];
  }

  async findAssignmentsByAssigneeName(name: string): Promise<CaseAssignment[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.name = @name',
      parameters: [
        {
          name: '@name',
          value: name,
        },
        {
          name: '@documentType',
          value: 'ASSIGNMENT',
        },
      ],
    };
    return (await this.queryData(querySpec)) as CaseAssignment[];
  }

  private async queryData(querySpec: object): Promise<CaseAssignment[] | CaseAssignmentHistory[]> {
    try {
      const { resources: results } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.query(querySpec)
        .fetchAll();
      return results;
    } catch (e) {
      log.error(this.applicationContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Failed to authenticate to Azure',
          originalError: e,
        });
      } else {
        throw e;
      }
    }
  }
}
