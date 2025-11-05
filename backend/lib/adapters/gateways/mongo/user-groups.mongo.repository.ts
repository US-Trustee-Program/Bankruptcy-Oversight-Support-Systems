import { ApplicationContext } from '../../../use-cases/application.types';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { UserGroupsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CamsUserReference, UserGroup } from '../../../../../common/src/cams/users';
import QueryBuilder from '../../../query/query-builder';

const MODULE_NAME = 'USER-GROUPS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'user-groups';

const { using } = QueryBuilder;

export type UserGroupDocument = UserGroup & {
  documentType: 'USER_GROUP';
};

export class UserGroupsMongoRepository extends BaseMongoRepository implements UserGroupsRepository {
  private static referenceCount: number = 0;
  private static instance: UserGroupsMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!UserGroupsMongoRepository.instance) {
      UserGroupsMongoRepository.instance = new UserGroupsMongoRepository(context);
    }
    UserGroupsMongoRepository.referenceCount++;
    return UserGroupsMongoRepository.instance;
  }

  public static dropInstance() {
    if (UserGroupsMongoRepository.referenceCount > 0) {
      UserGroupsMongoRepository.referenceCount--;
    }
    if (UserGroupsMongoRepository.referenceCount < 1) {
      UserGroupsMongoRepository.instance?.client.close().then();
      UserGroupsMongoRepository.instance = null;
    }
  }

  public release() {
    UserGroupsMongoRepository.dropInstance();
  }

  async getOversightStaff(context: ApplicationContext): Promise<{
    attorneys: CamsUserReference[];
    auditors: CamsUserReference[];
  }> {
    try {
      const groupNames = ['USTP CAMS Trial Attorney', 'USTP CAMS Auditor'];
      const doc = using<UserGroup>();
      const query = doc('groupName').contains(groupNames);
      const groups = await this.getAdapter<UserGroup>().find(query);

      const result = {
        attorneys: [] as CamsUserReference[],
        auditors: [] as CamsUserReference[],
      };

      for (const group of groups) {
        if (group.groupName === 'USTP CAMS Trial Attorney') {
          result.attorneys = group.users || [];
        } else if (group.groupName === 'USTP CAMS Auditor') {
          result.auditors = group.users || [];
        }
      }

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${result.attorneys.length} attorneys and ${result.auditors.length} auditors`,
      );

      return result;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to retrieve oversight staff from user-groups collection.',
      });
    }
  }

  async upsertUserGroupsBatch(context: ApplicationContext, userGroups: UserGroup[]): Promise<void> {
    if (userGroups.length === 0) {
      context.logger.info(MODULE_NAME, 'No user groups to upsert');
      return;
    }

    try {
      const doc = using<UserGroup>();
      const replacements = userGroups.map((group) => ({
        filter: doc('groupName').equals(group.groupName),
        replacement: { ...group, documentType: 'USER_GROUP' as const },
      }));

      const result = await this.getAdapter<UserGroup>().bulkReplace(replacements);

      context.logger.info(
        MODULE_NAME,
        `Bulk upsert completed: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`,
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to upsert user groups batch.',
      });
    }
  }
}
