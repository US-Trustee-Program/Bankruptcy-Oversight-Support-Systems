import { ApplicationContext } from '../../types/basic';
import { AttorneyUser, Staff } from '../../../../../common/src/cams/users';
import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { OfficesRepository, ReplaceResult } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { DEFAULT_STAFF_TTL } from '../../../use-cases/offices/offices';
import { isNotFoundError } from '../../../common-errors/not-found-error';

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
    user: Staff,
    ttl: number = DEFAULT_STAFF_TTL,
  ): Promise<ReplaceResult> {
    const existing = await this.findOneOfficeStaff(officeCode, user);
    const officeStaff = createAuditRecord<OfficeStaff>({
      id: user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...user,
      ttl: existing ? Math.max(existing.ttl, ttl) : ttl,
    });
    const query = QueryBuilder.build(
      and(equals<string>('id', officeStaff.id), equals<string>('officeCode', officeCode)),
    );
    try {
      return await this.getAdapter<OfficeStaff>().replaceOne(query, officeStaff, true);
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

  public async findAndDeleteStaff(officeCode: string, id: string): Promise<void> {
    const query = QueryBuilder.build(
      and(
        equals<OfficeStaff['officeCode']>('officeCode', officeCode),
        equals<OfficeStaff['id']>('id', id),
        equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
      ),
    );

    try {
      await this.getAdapter<OfficeStaff>().deleteOne(query);
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME);
      throw error;
    }
  }

  public async putOrExtendOfficeStaff(officeCode: string, staff: Staff, expires: string) {
    try {
      const existing = await this.findOneOfficeStaff(officeCode, staff);
      const newTtl = (new Date(expires).valueOf() - Date.now()) / 1000;

      let officeStaff: OfficeStaff;
      if (existing) {
        officeStaff = createAuditRecord<OfficeStaff>({
          ...existing,
          ttl: Math.max(existing.ttl, newTtl),
        });
        officeStaff.roles = Array.from(new Set([...existing.roles, ...staff.roles]));
      } else {
        officeStaff = createAuditRecord<OfficeStaff>({
          id: staff.id,
          documentType: 'OFFICE_STAFF',
          officeCode,
          ...staff,
          ttl: newTtl,
        });
      }

      const query = QueryBuilder.build(
        and(
          equals<OfficeStaff['officeCode']>('officeCode', officeCode),
          equals<OfficeStaff['id']>('id', staff.id),
          equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
        ),
      );
      await this.getAdapter<OfficeStaff>().replaceOne(query, officeStaff, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { message: 'Failed to create or update office staff.', module: MODULE_NAME },
      });
    }
  }

  private async findOneOfficeStaff(officeCode: string, staff: Staff): Promise<OfficeStaff | null> {
    const query = QueryBuilder.build(
      and(
        equals<OfficeStaff['officeCode']>('officeCode', officeCode),
        equals<OfficeStaff['id']>('id', staff.id),
        equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
      ),
    );

    try {
      return await this.getAdapter<OfficeStaff>().findOne(query);
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
