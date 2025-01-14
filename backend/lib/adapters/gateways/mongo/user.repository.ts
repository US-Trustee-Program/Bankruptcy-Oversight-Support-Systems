import { ApplicationContext } from '../../types/basic';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { ReplaceResult, UsersRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { UnknownError } from '../../../common-errors/unknown-error';
import { AugmentableUser } from '../../../../../common/src/cams/users';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULE_NAME: string = 'USERS_MONGO_REPOSITORY';
const COLLECTION_NAME = 'users';

const { and, equals } = QueryBuilder;

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
    if (UsersMongoRepository.referenceCount > 0) UsersMongoRepository.referenceCount--;
    if (UsersMongoRepository.referenceCount < 1) {
      UsersMongoRepository.instance.client.close().then();
      UsersMongoRepository.instance = null;
    }
  }

  public release() {
    UsersMongoRepository.dropInstance();
  }

  async putAugmentableUser(augmentableUser: AugmentableUser): Promise<ReplaceResult> {
    type AuditableAugmentableUser = AugmentableUser & Auditable;
    const user = createAuditRecord<AuditableAugmentableUser>(augmentableUser);
    const query = QueryBuilder.build(
      and(equals<string>('id', user.id), equals<string>('documentType', 'AUGMENTABLE_USER')),
    );
    try {
      const result = await this.getAdapter<AugmentableUser>().replaceOne(query, user, true);
      if (result.modifiedCount + result.upsertedCount !== 1) {
        throw new UnknownError(MODULE_NAME, {
          message: `While upserting augmentable user ${user.id}, we modified ${result.modifiedCount} and created ${result.upsertedCount} documents.`,
        });
      }
      return result;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write augmentable user ${user.id}.`,
      });
    }
  }

  async getAugmentableUser(id: string): Promise<AugmentableUser> {
    const query = QueryBuilder.build(
      and(
        equals<AugmentableUser['documentType']>('documentType', 'AUGMENTABLE_USER'),
        equals<AugmentableUser['id']>('id', id),
      ),
    );

    try {
      const result = await this.getAdapter<AugmentableUser>().find(query);
      if (!result || !result[0]) {
        throw new NotFoundError(MODULE_NAME);
      }
      return result[0];
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
