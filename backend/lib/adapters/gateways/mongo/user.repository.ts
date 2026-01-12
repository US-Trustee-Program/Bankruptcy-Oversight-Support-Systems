import { ApplicationContext } from '../../types/basic';
import { Auditable, createAuditRecord } from '@common/cams/auditable';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { ReplaceResult, UsersRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CamsUserReference, PrivilegedIdentityUser } from '@common/cams/users';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULE_NAME = 'USERS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'users';

const { and, using } = QueryBuilder;
const doc = using<PrivilegedIdentityUser>();

export class UsersMongoRepository extends BaseMongoRepository implements UsersRepository {
  private static referenceCount: number = 0;
  private static instance: UsersMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!UsersMongoRepository.instance)
      UsersMongoRepository.instance = new UsersMongoRepository(context);
    UsersMongoRepository.referenceCount++;
    return UsersMongoRepository.instance;
  }

  public static dropInstance() {
    if (UsersMongoRepository.referenceCount > 0) {
      UsersMongoRepository.referenceCount--;
    }
    if (UsersMongoRepository.referenceCount < 1) {
      UsersMongoRepository.instance?.client.close().then();
      UsersMongoRepository.instance = null;
    }
  }

  public release() {
    UsersMongoRepository.dropInstance();
  }

  async putPrivilegedIdentityUser(
    privilegedIdentityUser: PrivilegedIdentityUser,
    updatedBy: CamsUserReference,
  ): Promise<ReplaceResult> {
    type AuditablePrivilegedIdentityUser = PrivilegedIdentityUser & Auditable;
    const user = createAuditRecord<AuditablePrivilegedIdentityUser>(
      privilegedIdentityUser,
      updatedBy,
    );
    const query = and(
      doc('id').equals(user.id),
      doc('documentType').equals('PRIVILEGED_IDENTITY_USER'),
    );
    try {
      const result = await this.getAdapter<PrivilegedIdentityUser>().replaceOne(query, user, true);
      if (result.modifiedCount + result.upsertedCount !== 1) {
        throw new UnknownError(MODULE_NAME, {
          message: `While upserting privileged identity user ${user.id}, we modified ${result.modifiedCount} and created ${result.upsertedCount} documents.`,
        });
      }
      return result;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write privileged identity user ${user.id}.`,
      });
    }
  }

  async getPrivilegedIdentityUser(
    id: string,
    includeExpired: boolean = true,
  ): Promise<PrivilegedIdentityUser> {
    const query = and(doc('documentType').equals('PRIVILEGED_IDENTITY_USER'), doc('id').equals(id));

    try {
      const result = await this.getAdapter<PrivilegedIdentityUser>().find(query);
      if (!result || !result[0]) {
        throw new NotFoundError(MODULE_NAME);
      }
      if (new Date().valueOf() > new Date(result[0].expires).valueOf() && !includeExpired) {
        throw new NotFoundError(MODULE_NAME, {
          message: 'Expired elevation found.',
        });
      }
      return result[0];
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async deletePrivilegedIdentityUser(id: string): Promise<void> {
    const query = and(doc('id').equals(id), doc('documentType').equals('PRIVILEGED_IDENTITY_USER'));

    try {
      await this.getAdapter<PrivilegedIdentityUser>().deleteOne(query);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to delete privileged identity user ${id}.`,
      );
    }
  }
}
