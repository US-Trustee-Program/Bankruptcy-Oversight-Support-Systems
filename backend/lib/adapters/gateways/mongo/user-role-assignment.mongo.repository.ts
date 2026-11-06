import { UserRoleAssignment } from '@common/cams/user-access';
import { CamsRoleType } from '@common/cams/roles';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { UserRoleAssignmentRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { isDuplicateKeyError } from './utils/duplicate-key-error';

const MODULE_NAME = 'USER-ROLE-ASSIGNMENT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'user-role-assignments';

const { and, using } = QueryBuilder;
const doc = using<UserRoleAssignment>();

export class UserRoleAssignmentMongoRepository
  extends BaseMongoRepository
  implements UserRoleAssignmentRepository
{
  private static referenceCount: number = 0;
  private static instance: UserRoleAssignmentMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!UserRoleAssignmentMongoRepository.instance) {
      UserRoleAssignmentMongoRepository.instance = new UserRoleAssignmentMongoRepository(context);
    }
    UserRoleAssignmentMongoRepository.referenceCount++;
    return UserRoleAssignmentMongoRepository.instance;
  }

  public static dropInstance() {
    if (UserRoleAssignmentMongoRepository.referenceCount > 0) {
      UserRoleAssignmentMongoRepository.referenceCount--;
    }
    if (UserRoleAssignmentMongoRepository.referenceCount < 1) {
      UserRoleAssignmentMongoRepository.instance?.client.close().then();
      UserRoleAssignmentMongoRepository.instance = null;
    }
  }

  public release() {
    UserRoleAssignmentMongoRepository.dropInstance();
  }

  /**
   * Inserts the assignment, or returns null when the unique {userId, activeKey} index shows the user
   * already holds that exact active permission (for example, another grant just wrote it).
   */
  async create(assignment: UserRoleAssignment): Promise<UserRoleAssignment | null> {
    try {
      await this.getAdapter<UserRoleAssignment>().insertOne(assignment, { useProvidedId: true });
      return assignment;
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) return null;
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create role assignment.');
    }
  }

  async findActiveByUserAndRole(userId: string, role: CamsRoleType): Promise<UserRoleAssignment[]> {
    const query = and(
      doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
      doc('userId').equals(userId),
      doc('role').equals(role),
      doc('active').equals(true),
    );
    try {
      return await this.getAdapter<UserRoleAssignment>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve role assignments.');
    }
  }

  async findActiveByUserIds(userIds: string[]): Promise<UserRoleAssignment[]> {
    if (userIds.length === 0) {
      return [];
    }
    const query = and(
      doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
      doc('active').equals(true),
      doc('userId').contains(userIds),
    );
    try {
      return await this.getAdapter<UserRoleAssignment>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve role assignments.');
    }
  }
}
