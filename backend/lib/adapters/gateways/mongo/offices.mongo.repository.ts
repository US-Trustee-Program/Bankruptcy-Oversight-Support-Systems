import { Auditable, createAuditRecord } from '../../../../../common/src/cams/auditable';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import { CamsUserReference, Staff } from '../../../../../common/src/cams/users';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import QueryBuilder from '../../../query/query-builder';
import { OfficesRepository, ReplaceResult } from '../../../use-cases/gateways.types';
import { DEFAULT_STAFF_TTL } from '../../../use-cases/offices/offices';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'OFFICES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'offices';

const { and, using } = QueryBuilder;
const doc = using<OfficeStaff>();

export type OfficeStaff = Auditable &
  Staff & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
    ttl: number;
  };

export class OfficesMongoRepository extends BaseMongoRepository implements OfficesRepository {
  private static instance: OfficesMongoRepository;
  private static referenceCount: number = 0;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static dropInstance() {
    if (OfficesMongoRepository.referenceCount > 0) {
      OfficesMongoRepository.referenceCount--;
    }
    if (OfficesMongoRepository.referenceCount < 1) {
      OfficesMongoRepository.instance.client.close().then();
      OfficesMongoRepository.instance = null;
    }
  }

  public static getInstance(context: ApplicationContext) {
    if (!OfficesMongoRepository.instance) {
      OfficesMongoRepository.instance = new OfficesMongoRepository(context);
    }
    OfficesMongoRepository.referenceCount++;
    return OfficesMongoRepository.instance;
  }

  public async findAndDeleteStaff(officeCode: string, id: string): Promise<void> {
    const query = and(
      doc('officeCode').equals(officeCode),
      doc('id').equals(id),
      doc('documentType').equals('OFFICE_STAFF'),
    );

    try {
      await this.getAdapter<OfficeStaff>().deleteOne(query);
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME);
      throw error;
    }
  }

  async getOfficeAttorneys(officeCode: string): Promise<CamsUserReference[]> {
    const doc = using<OfficeStaff>();
    const query = and(
      doc('documentType').equals('OFFICE_STAFF'),
      doc('roles').contains([CamsRole.TrialAttorney]),
      doc('officeCode').equals(officeCode),
    );

    try {
      const result = await this.getAdapter<OfficeStaff>().find(query);
      return result.map((doc) => getCamsUserReference(doc));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async putOfficeStaff(
    officeCode: string,
    user: Staff,
    ttl: number = DEFAULT_STAFF_TTL,
  ): Promise<ReplaceResult> {
    const existing = await this.findOneOfficeStaff(officeCode, user);
    const officeStaff = createAuditRecord<OfficeStaff>({
      documentType: 'OFFICE_STAFF',
      id: user.id,
      officeCode,
      ...user,
      ttl: existing ? Math.max(existing.ttl, ttl) : ttl,
    });
    const query = and(doc('id').equals(officeStaff.id), doc('officeCode').equals(officeCode));
    try {
      return await this.getAdapter<OfficeStaff>().replaceOne(query, officeStaff, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write user ${user.id} to ${officeCode}.`,
      });
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
          documentType: 'OFFICE_STAFF',
          id: staff.id,
          officeCode,
          ...staff,
          ttl: newTtl,
        });
      }

      const query = and(
        doc('officeCode').equals(officeCode),
        doc('id').equals(staff.id),
        doc('documentType').equals('OFFICE_STAFF'),
      );

      await this.getAdapter<OfficeStaff>().replaceOne(query, officeStaff, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { message: 'Failed to create or update office staff.', module: MODULE_NAME },
      });
    }
  }

  public release() {
    OfficesMongoRepository.dropInstance();
  }

  private async findOneOfficeStaff(officeCode: string, staff: Staff): Promise<null | OfficeStaff> {
    const query = and(
      doc('officeCode').equals(officeCode),
      doc('id').equals(staff.id),
      doc('documentType').equals('OFFICE_STAFF'),
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
