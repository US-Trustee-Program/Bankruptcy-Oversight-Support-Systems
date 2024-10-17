//import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';

// TODO: Better name???
const MODULE_NAME: string = 'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS';

export class CaseAssignmentCosmosMongoDbRepository {
  private documentClient: DocumentClient;

  constructor(connectionString: string) {
    this.documentClient = new DocumentClient(connectionString);
  }

  async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');
    const result = await collection.insertOne(caseAssignment);
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

    const assignments: CaseAssignment[] = [];

    for await (const doc of result) {
      assignments.push(doc);
    }

    return assignments;
  }

  async findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]> {
    //TODO: revisit to add an or clause with an empty string?

    const query: DocumentQuery = {
      and: [
        { documentType: { equals: 'ASSIGNMENT' } },
        { userId: { equals: userId } },
        { unassignedOn: { exists: false } },
      ],
    };

    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');

    const result = await collection.find(query);

    const assignments: CaseAssignment[] = [];

    for await (const doc of result) {
      assignments.push(doc);
    }

    return assignments;
  }

  async close() {
    this.documentClient.close();
  }

  // private async queryData(querySpec: object): Promise<CaseAssignment[] | CaseAssignmentHistory[]> {}
}
