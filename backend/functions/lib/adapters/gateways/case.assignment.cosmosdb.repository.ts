import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getAssignmentsCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import { AggregateAuthenticationError } from '@azure/identity';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { CaseAssignmentHistory } from '../../../../../common/src/cams/history';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';

export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;
  private applicationContext: ApplicationContext;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor(applicationContext: ApplicationContext) {
    this.cosmosDbClient = getAssignmentsCosmosDbClient(applicationContext);
    this.cosmosConfig = getCosmosConfig(applicationContext);
    this.applicationContext = applicationContext;
  }

  async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    try {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(caseAssignment);
      this.applicationContext.logger.debug(MODULE_NAME, `New item created ${resource.id}`);
      return resource.id;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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

  async updateAssignment(caseAssignment: CaseAssignment): Promise<string> {
    try {
      const { resource } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .item(caseAssignment.id)
        .replace(caseAssignment);
      this.applicationContext.logger.debug(MODULE_NAME, `Assignment updated ${resource.id}`);
      return resource.id;
    } catch (e) {
      this.applicationContext.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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

  getAssignment(_assignmentId: string): Promise<CaseAssignment> {
    throw new Error('Method not implemented.');
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
      ],
    };
    const response = await this.queryData(querySpec);
    return response as CaseAssignment[];
  }

  async findAssignmentsByAssigneeName(name: string): Promise<CaseAssignment[]> {
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.name = @name AND c.documentType = "ASSIGNMENT" AND NOT IS_DEFINED(c.unassignedOn)',
      parameters: [
        {
          name: '@name',
          value: name,
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
      this.applicationContext.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
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
