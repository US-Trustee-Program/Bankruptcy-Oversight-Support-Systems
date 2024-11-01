import { ApplicationContext } from '../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import QueryBuilder from '../../query/query-builder';
import { CaseAssignmentRepository } from '../../use-cases/gateways.types';
import { getCamsError } from '../../common-errors/error-utilities';
import { BaseMongoRepository } from './mongo/base-mongo-repository';

const MODULE_NAME: string = 'CASE_ASSIGNMENT_MONGO_REPOSITORY';
const COLLECTION_NAME = 'assignments';

const { and, equals, exists } = QueryBuilder;

export class CaseAssignmentCosmosMongoDbRepository
  extends BaseMongoRepository
  implements CaseAssignmentRepository
{
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  async create(caseAssignment: CaseAssignment): Promise<string> {
    try {
      return await this.getAdapter<CaseAssignment>().insertOne(caseAssignment);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create assignment.');
    }
  }

  async update(caseAssignment: CaseAssignment): Promise<string> {
    const query = equals<CaseAssignment['id']>('id', caseAssignment.id);
    try {
      return await this.getAdapter<CaseAssignment>().replaceOne(query, caseAssignment);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update assignment.');
    }
  }

  async findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]> {
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        equals<CaseAssignment['caseId']>('caseId', caseId),
        exists<CaseAssignment>('unassignedOn', false),
      ),
    );
    try {
      return await this.getAdapter<CaseAssignment>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve assignment.');
    }
  }

  async findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]> {
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        equals<CaseAssignment['userId']>('userId', userId),
        exists<CaseAssignment>('unassignedOn', false),
      ),
    );

    try {
      return await this.getAdapter<CaseAssignment>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve assignment.');
    }
  }
}
