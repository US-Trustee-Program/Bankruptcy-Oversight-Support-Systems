import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';
import { AggregateAuthenticationError } from '@azure/identity';
import { AssignmentException } from '../../use-cases/assignment.exception';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';
export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;
  private appContext: ApplicationContext;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor(context: ApplicationContext, testClient = false) {
    this.cosmosDbClient = getCosmosDbClient(testClient);
    this.cosmosConfig = getCosmosConfig();
    this.appContext = context;
  }

  async createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string> {
    try {
      // Check write access
      const { item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(caseAssignment);
      log.debug(this.appContext, MODULE_NAME, `New item created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(this.appContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e.status === 403) {
        throw new Error('Request is forbidden');
      } else throw e;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignment(caseAssignment: CaseAttorneyAssignment): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }

  async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.caseId = @caseId',
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
      log.error(this.appContext, MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
      if (e instanceof AggregateAuthenticationError) {
        throw new AssignmentException(403, 'Failed to authenticate to Azure', MODULE_NAME);
      }
    }
  }
}
