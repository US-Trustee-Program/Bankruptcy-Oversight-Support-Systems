import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { toMongoQuery } from '../../query/mongo-query-renderer';
import QueryBuilder from '../../query/query-builder';
import { Closable, deferClose } from '../../defer-close';
import { UnknownError } from '../../common-errors/unknown-error';

// TODO: Better name???
const MODULE_NAME: string = 'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS';
const { and, equals, exists } = QueryBuilder;

export class CaseAssignmentCosmosMongoDbRepository implements Closable {
  private documentClient: DocumentClient;

  constructor(context: ApplicationContext) {
    this.documentClient = new DocumentClient(context.config.cosmosConfig.mongoDbConnectionString);
    deferClose(context, this);
  }

  async createAssignment(caseAssignment: CaseAssignment): Promise<string> {
    let result;
    try {
      const collection = this.documentClient
        .database('cams')
        .collection<CaseAssignment>('assignments');
      result = await collection.insertOne(caseAssignment);
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to create assignment.',
      });
    }
    const id = result.insertedId.toString();
    return id;
  }

  async updateAssignment(caseAssignment: CaseAssignment): Promise<string> {
    const collection = this.documentClient
      .database('cams')
      .collection<CaseAssignment>('assignments');
    const query = toMongoQuery(QueryBuilder.equals('id', caseAssignment.id));

    try {
      const result = await collection.replaceOne(query, caseAssignment);
      if (result.modifiedCount === 0) {
        throw new NotFoundError(MODULE_NAME);
      }
      return caseAssignment.id;
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to update assignment.',
      });
    }
  }

  getAssignment(_assignmentId: string): Promise<CaseAssignment> {
    throw new Error('Method not implemented.');
  }

  async findAssignmentsByCaseId(
    // context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignment[]> {
    const query = toMongoQuery(
      QueryBuilder.build(
        and(
          equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
          equals<CaseAssignment['caseId']>('caseId', caseId),
        ),
      ),
    );
    const assignments: CaseAssignment[] = [];
    try {
      const collection = this.documentClient
        .database('cams')
        .collection<CaseAssignment>('assignments');

      const result = await collection.find(query);

      for await (const doc of result) {
        assignments.push(doc);
      }
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to retrieve assignments.',
      });
    }

    return assignments;
  }

  async findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]> {
    //TODO: revisit to add an or clause with an empty string?
    const query = toMongoQuery(
      QueryBuilder.build(
        and(
          equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
          equals<CaseAssignment['userId']>('userId', userId),
          exists<CaseAssignment>('unassignedOn', false),
        ),
      ),
    );

    const assignments: CaseAssignment[] = [];
    try {
      const collection = this.documentClient
        .database('cams')
        .collection<CaseAssignment>('assignments');

      const result = await collection.find(query);

      for await (const doc of result) {
        assignments.push(doc);
      }
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to retrieve assignments.',
      });
    }

    return assignments;
  }

  async close() {
    await this.documentClient.close();
  }
}
