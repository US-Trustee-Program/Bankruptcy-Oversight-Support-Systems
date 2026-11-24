import { RoleAssignmentAuditEntry } from '@common/cams/user-access';
import { getCamsError } from '../../../common-errors/error-utilities';
import { RoleAssignmentAuditRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ROLE-ASSIGNMENT-AUDIT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'role-assignment-audit';

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
}
