import { RoleAssignmentAuditEntry } from '@common/cams/user-access';
import { RoleAssignmentAuditSearchPredicate } from '@common/api/search';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import {
  CamsPaginationResponse,
  RoleAssignmentAuditRepository,
} from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryPipeline from '../../../query/query-pipeline';

const MODULE_NAME = 'ROLE-ASSIGNMENT-AUDIT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'role-assignment-audit';

const { and, using } = QueryBuilder;
const doc = using<RoleAssignmentAuditEntry>();
const { descending, match, paginate, pipeline, sort, source } = QueryPipeline;

/**
 * Append-only store for role assignment audit records.
 */
export class RoleAssignmentAuditMongoRepository
  extends BaseMongoRepository
  implements RoleAssignmentAuditRepository
{
  private static referenceCount: number = 0;
  private static instance: RoleAssignmentAuditMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!RoleAssignmentAuditMongoRepository.instance) {
      RoleAssignmentAuditMongoRepository.instance = new RoleAssignmentAuditMongoRepository(context);
    }
    RoleAssignmentAuditMongoRepository.referenceCount++;
    return RoleAssignmentAuditMongoRepository.instance;
  }

  public static dropInstance() {
    if (RoleAssignmentAuditMongoRepository.referenceCount > 0) {
      RoleAssignmentAuditMongoRepository.referenceCount--;
    }
    if (RoleAssignmentAuditMongoRepository.referenceCount < 1) {
      RoleAssignmentAuditMongoRepository.instance?.client.close().then();
      RoleAssignmentAuditMongoRepository.instance = null;
    }
  }

  public release() {
    RoleAssignmentAuditMongoRepository.dropInstance();
  }

  async create(entry: RoleAssignmentAuditEntry): Promise<void> {
    try {
      await this.getAdapter<RoleAssignmentAuditEntry>().insertOne(entry, { useProvidedId: true });
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create role assignment audit record.',
      );
    }
  }

  async search(
    predicate: RoleAssignmentAuditSearchPredicate,
  ): Promise<CamsPaginationResponse<RoleAssignmentAuditEntry>> {
    if (predicate.userIds && predicate.userIds.length === 0) {
      return { metadata: { total: 0 }, data: [] };
    }
    try {
      const [performedAt, action, id] = source<RoleAssignmentAuditEntry>().fields(
        'performedAt',
        'action',
        'id',
      );
      const conditions = [doc('documentType').equals('ROLE_ASSIGNMENT_AUDIT')];
      if (predicate.userIds) {
        conditions.push(doc('userId').contains(predicate.userIds));
      }
      const spec = pipeline(
        match(and(...conditions)),
        sort(descending(performedAt), descending(action), descending(id)),
        paginate(predicate.offset, predicate.limit),
      );
      return await this.getAdapter<RoleAssignmentAuditEntry>().paginate(spec);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to search role assignment audit records.',
      );
    }
  }
}
