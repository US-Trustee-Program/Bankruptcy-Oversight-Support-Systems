import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { ServerConfigError } from '../../common-errors/server-config-error';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';
interface FindAssignmentsByCaseIdProps {
  includeHistory?: boolean;
}

export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;
  private applicationContext: ApplicationContext;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext, testClient = false) {
    this.cosmosDbClient = getCosmosDbClient(applicationContext, testClient);
    this.cosmosConfig = getCosmosConfig(applicationContext);
    this.applicationContext = applicationContext;
  }

  async createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
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

  async updateAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
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
  getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }

  async assignmentExists(assignment: CaseAttorneyAssignment): Promise<boolean> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId AND c.name = @name AND c.role = @role',
      parameters: [
        {
          name: '@caseId',
          value: assignment.caseId,
        },
        {
          name: '@name',
          value: assignment.name,
        },
        {
          name: '@role',
          value: assignment.role,
        },
      ],
    };
    const response = await this.queryData(querySpec);
    return !!response.length;
  }

  async findAssignmentsByCaseId(
    caseId: string,
    options?: FindAssignmentsByCaseIdProps,
  ): Promise<CaseAttorneyAssignment[]> {
    let query = '';
    if (options && options.includeHistory) {
      query = 'SELECT * FROM c WHERE c.caseId = @caseId';
    } else {
      query = 'SELECT * FROM c WHERE c.caseId = @caseId AND c.unassigned != true';
    }
    const querySpec = {
      query,
      parameters: [
        {
          name: '@caseId',
          value: caseId,
        },
      ],
    };
    return await this.queryData(querySpec);
  }

  async findAssignmentsByAssigneeName(name: string): Promise<CaseAttorneyAssignment[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.name = @name',
      parameters: [
        {
          name: '@name',
          value: name,
        },
      ],
    };
    return await this.queryData(querySpec);
  }

  private async queryData(querySpec: object): Promise<CaseAttorneyAssignment[]> {
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
      }
    }
  }
}
