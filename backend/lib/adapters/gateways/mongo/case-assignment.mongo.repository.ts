import { ApplicationContext } from '../../types/basic';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import QueryBuilder from '../../../query/query-builder';
import { CaseAssignmentRepository } from '../../../use-cases/gateways.types';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME: string = 'CASE_ASSIGNMENT_MONGO_REPOSITORY';
const COLLECTION_NAME = 'assignments';

const { and, equals, exists, contains } = QueryBuilder;

export class CaseAssignmentMongoRepository
  extends BaseMongoRepository
  implements CaseAssignmentRepository
{
  private static referenceCount: number = 0;
  private static instance: CaseAssignmentMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!CaseAssignmentMongoRepository.instance)
      CaseAssignmentMongoRepository.instance = new CaseAssignmentMongoRepository(context);
    CaseAssignmentMongoRepository.referenceCount++;
    return CaseAssignmentMongoRepository.instance;
  }

  public static dropInstance() {
    if (CaseAssignmentMongoRepository.referenceCount > 0)
      CaseAssignmentMongoRepository.referenceCount--;
    if (CaseAssignmentMongoRepository.referenceCount < 1) {
      CaseAssignmentMongoRepository.instance.client.close().then();
      CaseAssignmentMongoRepository.instance = null;
    }
  }

  public release() {
    CaseAssignmentMongoRepository.dropInstance();
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
      const result = await this.getAdapter<CaseAssignment>().replaceOne(query, caseAssignment);
      if (result.modifiedCount > 0) {
        return result.id;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update assignment.');
    }
  }
  //Maybe rename this function properly?
  async findAssignmentsByCaseId(caseIds: string[]): Promise<Map<string, CaseAssignment[]>> {
    const query = QueryBuilder.build(
      and(
        equals<CaseAssignment['documentType']>('documentType', 'ASSIGNMENT'),
        contains<string[]>('caseId', caseIds),
        exists<CaseAssignment>('unassignedOn', false),
      ),
    );
    try {
      const assignments = await this.getAdapter<CaseAssignment>().find(query);
      const assignmentsMap = new Map();
      assignments.forEach((assignment) => {
        if (assignmentsMap.has(assignment.caseId)) {
          assignmentsMap.set(assignment.caseId, [
            ...assignmentsMap.get(assignment.caseId),
            assignment,
          ]);
        } else {
          assignmentsMap.set(assignment.caseId, [assignment]);
        }
      });
      return assignmentsMap;
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
