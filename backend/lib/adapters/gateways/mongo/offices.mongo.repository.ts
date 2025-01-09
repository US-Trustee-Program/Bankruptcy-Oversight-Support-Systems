import { ApplicationContext } from '../../types/basic';
import { AttorneyUser, CamsUserReference, Staff } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { OfficesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME: string = 'OFFICES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'offices';

const { and, equals, contains } = QueryBuilder;

export type OfficeStaff = Staff &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesMongoRepository extends BaseMongoRepository implements OfficesRepository {
  private static referenceCount: number = 0;
  private static instance: OfficesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!OfficesMongoRepository.instance)
      OfficesMongoRepository.instance = new OfficesMongoRepository(context);
    OfficesMongoRepository.referenceCount++;
    return OfficesMongoRepository.instance;
  }

  public static dropInstance() {
    if (OfficesMongoRepository.referenceCount > 0) OfficesMongoRepository.referenceCount--;
    if (OfficesMongoRepository.referenceCount < 1) {
      OfficesMongoRepository.instance.client.close().then();
      OfficesMongoRepository.instance = null;
    }
  }

  public release() {
    OfficesMongoRepository.dropInstance();
  }

  async putOfficeStaff(
    officeCode: string,
    user: CamsUserReference,
    ttl: number = 86400,
  ): Promise<void> {
    const staff = createAuditRecord<OfficeStaff>({
      id: user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...user,
      ttl,
    });
    const query = QueryBuilder.build(
      and(equals<string>('id', staff.id), equals<string>('officeCode', officeCode)),
    );
    try {
      await this.getAdapter<OfficeStaff>().replaceOne(query, staff, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write user ${user.id} to ${officeCode}.`,
      });
    }
  }

  async getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]> {
    const query = QueryBuilder.build(
      and(
        equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
        contains<OfficeStaff['roles']>('roles', [CamsRole.TrialAttorney]),
        equals<OfficeStaff['officeCode']>('officeCode', officeCode),
      ),
    );

    try {
      const result = await this.getAdapter<AttorneyUser>().find(query);
      return result.map((doc) => getCamsUserReference(doc));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async findAndDeleteStaff(_officeCode: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
