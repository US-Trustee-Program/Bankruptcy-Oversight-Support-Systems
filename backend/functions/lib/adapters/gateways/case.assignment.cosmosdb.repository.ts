import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import { getCosmosConfig, getCosmosDbClient } from '../../factory';
import { CosmosConfig } from '../types/database';
import log from '../services/logger.service';

const NAMESPACE: string = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';
export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;

  private containerName = 'assignments';
  private cosmosConfig: CosmosConfig;

  constructor() {
    this.cosmosDbClient = getCosmosDbClient();
    this.cosmosConfig = getCosmosConfig();
  }

  async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    try {
      // Check write access
      const { item: item } = await this.cosmosDbClient
        .database(this.cosmosConfig.databaseName)
        .container(this.containerName)
        .items.create(caseAssignment);
      log.debug(context, NAMESPACE, `New item created ${item.id}`);
      return item.id;
    } catch (e) {
      log.error(context, NAMESPACE, `${e.name}: ${e.message}`);
      if (e.code === '403') {
        throw new Error('Request is forbidden');
      } else throw e;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAssignment(assignmentId: number): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignment(caseAssignment: CaseAttorneyAssignment): Promise<CaseAttorneyAssignment> {
    throw new Error('Method not implemented.');
  }
  getCount(): Promise<number> {
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findAssignmentByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    throw new Error('Method not implemented.');
  }
}
