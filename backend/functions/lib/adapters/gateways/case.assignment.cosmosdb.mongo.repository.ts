import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import QueryBuilder from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseAssignmentRepository } from '../../use-cases/gateways.types';
import { DocumentCollectionAdapter } from './document-collection.adapter';
import { getDocumentCollectionAdapter } from '../../factory';

// TODO: Better name???
const MODULE_NAME: string = 'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS';
const { and, equals, exists } = QueryBuilder;

export class CaseAssignmentCosmosMongoDbRepository implements CaseAssignmentRepository {
  private readonly collectionName = 'assignments';
  private context: ApplicationContext;
  private readonly adapter: DocumentCollectionAdapter<CaseAssignment>;

  //TODO: do we want to use this instantiation of ApplicationContext across all repos? or the implementation in cases.cosmosdb.mongo
  constructor(context: ApplicationContext) {
    const client = new DocumentClient(context.config.documentDbConfig.connectionString);
    this.context = context;
    this.adapter = getDocumentCollectionAdapter<CaseAssignment>(
      MODULE_NAME,
      client.database(context.config.documentDbConfig.databaseName).collection(this.collectionName),
    );
    deferClose(context, client);
  }

  async create(caseAssignment: CaseAssignment): Promise<string> {
    let result;
    try {
      result = await this.adapter.insertOne(caseAssignment);
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to create assignment.',
      });
    }
    const id = result.insertedId.toString();
    return id;
  }

  async update(caseAssignment: CaseAssignment): Promise<string> {
    const query = QueryBuilder.equals('id', caseAssignment.id);

    try {
      return await this.adapter.replaceOne(query, caseAssignment);
    } catch (error) {
      throw new UnknownError(MODULE_NAME, {
        originalError: error,
        message: 'Unable to update assignment.',
      });
    }
  }

  async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        equals<CaseAssignment['caseId']>('caseId', caseId),
      ),
    );
    const assignments: CaseAssignment[] = [];
    try {
      const result = await this.adapter.find(query);

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
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        equals<CaseAssignment['userId']>('userId', userId),
        exists<CaseAssignment>('unassignedOn', false),
      ),
    );

    const assignments: CaseAssignment[] = [];
    try {
      const result = await this.adapter.find(query);

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
}
