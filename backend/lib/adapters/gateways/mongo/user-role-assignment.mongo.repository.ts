import { activeKeyFor, inactiveKeyFor, UserRoleAssignment } from '@common/cams/user-access';
import { CamsRoleType } from '@common/cams/roles';
import { CamsError } from '../../../common-errors/cams-error';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { UserRoleAssignmentRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { isDuplicateKeyError } from './utils/duplicate-key-error';

const MODULE_NAME = 'USER-ROLE-ASSIGNMENT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'user-role-assignments';

const UNIQUE_INDEX_FIELDS = ['userId', 'activeKey'];

const { and, using } = QueryBuilder;
const doc = using<UserRoleAssignment>();

export class UserRoleAssignmentMongoRepository
  extends BaseMongoRepository
  implements UserRoleAssignmentRepository
{
  private static referenceCount: number = 0;
  private static instance: UserRoleAssignmentMongoRepository | null = null;
  private uniqueIndexConfirmed = false;

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
   *
   * Refuses to write until it has confirmed the index exists: without it, duplicate grants would be
   * stored silently, and Cosmos cannot add a unique index once the collection has documents.
   */
  async create(assignment: UserRoleAssignment): Promise<UserRoleAssignment | null> {
    await this.requireUniqueIndex();
    try {
      await this.getAdapter<UserRoleAssignment>().insertOne(assignment, { useProvidedId: true });
      return assignment;
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) return null;
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create role assignment.');
    }
  }

  private async requireUniqueIndex() {
    if (this.uniqueIndexConfirmed) return;
    let present: boolean;
    try {
      present = await this.getAdapter<UserRoleAssignment>().hasUniqueIndex(UNIQUE_INDEX_FIELDS);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create role assignment.');
    }
    if (!present) {
      throw new CamsError(MODULE_NAME, {
        message: `Unable to create role assignment: ${COLLECTION_NAME} has no unique {userId, activeKey} index.`,
      });
    }
    this.uniqueIndexConfirmed = true;
  }

  /**
   * Marks the assignment inactive. Its activeKey becomes unique to it, because the unique
   * {userId, activeKey} index ignores `active`: otherwise the same scope could never be granted
   * again. The filter includes userId, the collection's shard key.
   */
  async deactivate(
    assignment: Pick<UserRoleAssignment, 'userId' | 'id'>,
  ): Promise<UserRoleAssignment | null> {
    const changes = { active: false, activeKey: inactiveKeyFor(assignment.id) };
    try {
      return await this.getAdapter<UserRoleAssignment>().findOneAndUpdate(
        and(
          doc('userId').equals(assignment.userId),
          doc('id').equals(assignment.id),
          doc('active').equals(true),
        ),
        { $set: changes },
        { returnDocument: 'after' },
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to deactivate role assignment.');
    }
  }

  async reactivate(
    assignment: Pick<UserRoleAssignment, 'userId' | 'id' | 'role' | 'regionId' | 'officeCode'>,
  ): Promise<UserRoleAssignment | null> {
    const changes = {
      active: true,
      activeKey: activeKeyFor(assignment.role, assignment.regionId, assignment.officeCode),
    };
    try {
      return await this.getAdapter<UserRoleAssignment>().findOneAndUpdate(
        and(
          doc('userId').equals(assignment.userId),
          doc('id').equals(assignment.id),
          doc('active').equals(false),
        ),
        { $set: changes },
        { returnDocument: 'after' },
      );
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) return null;
      throw getCamsError(originalError, MODULE_NAME, 'Unable to reactivate role assignment.');
    }
  }

  /** Reads across every user's partition; the result is small (one count). */
  async countActiveByRole(role: CamsRoleType): Promise<number> {
    const query = and(
      doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
      doc('role').equals(role),
      doc('active').equals(true),
    );
    try {
      return await this.getAdapter<UserRoleAssignment>().countDocuments(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve role assignments.');
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

  async findByIds(
    refs: Pick<UserRoleAssignment, 'userId' | 'id'>[],
  ): Promise<UserRoleAssignment[]> {
    if (refs.length === 0) {
      return [];
    }
    // userId is the shard key: filtering on it keeps the read to those users' partitions. Ids are
    // unique, so matching each list separately can't pair one user's id with another user.
    const query = and(
      doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
      doc('userId').contains([...new Set(refs.map((ref) => ref.userId))]),
      doc('id').contains(refs.map((ref) => ref.id)),
    );
    try {
      return await this.getAdapter<UserRoleAssignment>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve role assignments.');
    }
  }
}
