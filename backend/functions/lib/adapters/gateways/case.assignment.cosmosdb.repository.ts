import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import { getCosmosDbClient } from '../../factory';

export class CaseAssignmentCosmosDbRepository implements CaseAssignmentRepositoryInterface {
  private cosmosDbClient;

  private databaseName = '';
  private containerName = 'assignments';

  constructor() {
    this.cosmosDbClient = getCosmosDbClient();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    throw new Error('Method not implemented.' + context + caseAssignment);
    // try {
    //   // Check write access
    //   const { item: item } = await this.cosmosDbClient
    //     .database(this.databaseName)
    //     .container(this.CONTAINER_NAME)
    //     .items.create({});
    //   log.debug(this.ctx, NAMESPACE, `New item created ${item.id}`);
    //   return item.id;
    // } catch (e) {
    //   log.error(this.ctx, NAMESPACE, `${e.name}: ${e.message}`);
    // }
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
