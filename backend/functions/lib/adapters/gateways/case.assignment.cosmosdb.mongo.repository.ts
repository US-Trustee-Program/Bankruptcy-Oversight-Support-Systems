//import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';

// TODO: Better name???
const MODULE_NAME: string = 'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS';

export class CaseAssignmentCosmosMongoDbRepository {
  private documentClient: DocumentClient;
  // private containerName = 'assignments';

  constructor(connectionString: string) {
    this.documentClient = new DocumentClient(connectionString);
  }

  async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');
    const result = await collection.insertOne(caseAssignment);
    //context.logger.info(MODULE_NAME, 'result', result);
    const id = result.insertedId.toString();
    return id;
  }

  async updateAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');

    const query: DocumentQuery = {
      id: { equals: caseAssignment.id },
    };

    try {
      const result = await collection.replaceOne(query, caseAssignment);
      //context.logger.info(MODULE_NAME, 'result', result);
      if (result.modifiedCount === 0) {
        throw new NotFoundError(MODULE_NAME);
      }
      return caseAssignment.id;
    } catch (e) {
      console.log(e);
    }
  }

  getAssignment(_assignmentId: string): Promise<CaseAssignment> {
    throw new Error('Method not implemented.');
  }

  async findAssignmentsByCaseId(
    // context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignment[]> {
    const query: DocumentQuery = {
      and: [{ documentType: { equals: 'ASSIGNMENT' } }, { caseId: { equals: caseId } }],
    };

    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');

    const result = await collection.find(query);
    //const count = await collection.countDocuments(query);

    // if (count === 0) {
    //   context.logger.warn(MODULE_NAME, 'No documents found!');
    // }

    const assignments: CaseAssignment[] = [];

    for await (const doc of result) {
      assignments.push(doc);
      // context.logger.info(MODULE_NAME, 'result', doc);
    }

    return assignments;
  }

  async findAssignmentsByAssignee(_userId: string): Promise<CaseAssignment[]> {
    throw new Error('Not Implented');
  }

  async close() {
    this.documentClient.close();
  }

  // private async queryData(querySpec: object): Promise<CaseAssignment[] | CaseAssignmentHistory[]> {}
}
