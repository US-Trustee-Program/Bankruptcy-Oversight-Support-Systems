import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import QueryBuilder from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { CaseAssignmentRepository } from '../../use-cases/gateways.types';
import { DocumentCollectionAdapter } from './document-collection.adapter';
import { getDocumentCollectionAdapter } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

// TODO: Better name???
const MODULE_NAME: string = 'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS';
const COLLECTION_NAME = 'assignments';

const { and, equals, exists } = QueryBuilder;

export class CaseAssignmentCosmosMongoDbRepository implements CaseAssignmentRepository {
  private readonly dbAdapter: DocumentCollectionAdapter<CaseAssignment>;

  //TODO: do we want to use this instantiation of ApplicationContext across all repos? or the implementation in cases.cosmosdb.mongo
  constructor(context: ApplicationContext) {
    const client = new DocumentClient(context.config.documentDbConfig.connectionString);
    this.dbAdapter = getDocumentCollectionAdapter<CaseAssignment>(
      MODULE_NAME,
      client.database(context.config.documentDbConfig.databaseName).collection(COLLECTION_NAME),
    );
    deferClose(context, client);
  }

  async create(caseAssignment: CaseAssignment): Promise<string> {
    try {
      return await this.dbAdapter.insertOne(caseAssignment);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create assignment.');
    }
  }

  async update(caseAssignment: CaseAssignment): Promise<string> {
    const query = QueryBuilder.equals('id', caseAssignment.id);

    try {
      return await this.dbAdapter.replaceOne(query, caseAssignment);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update assignment.');
    }
  }

  async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        equals<CaseAssignment['caseId']>('caseId', caseId),
      ),
    );
    try {
      return await this.dbAdapter.find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve assignment.');
    }
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

    try {
      return await this.dbAdapter.find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve assignment.');
    }
  }
}
