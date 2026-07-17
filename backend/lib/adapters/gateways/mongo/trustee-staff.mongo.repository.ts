import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeStaffRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-STAFF-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { using, and } = QueryBuilder;

// documentType intentionally NOT renamed to 'TRUSTEE_STAFF' — renaming requires a data migration. Tracked under CAMS-826 follow-up.
type TrusteeStaffDocument = TrusteeStaff & {
  documentType: 'TRUSTEE_ASSISTANT';
};

export class TrusteeStaffMongoRepository
  extends BaseMongoRepository
  implements TrusteeStaffRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeStaffMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeStaffMongoRepository.instance) {
      TrusteeStaffMongoRepository.instance = new TrusteeStaffMongoRepository(context);
    }
    TrusteeStaffMongoRepository.referenceCount++;
    return TrusteeStaffMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeStaffMongoRepository.referenceCount > 0) {
      TrusteeStaffMongoRepository.referenceCount--;
    }
    if (TrusteeStaffMongoRepository.referenceCount < 1) {
      TrusteeStaffMongoRepository.instance?.client.close().then();
      TrusteeStaffMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeStaffMongoRepository.dropInstance();
  }

  async read(trusteeId: string, staffId: string): Promise<TrusteeStaff> {
    try {
      const doc = using<TrusteeStaffDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('id').equals(staffId),
        doc('trusteeId').equals(trusteeId),
      );
      const staffMember = await this.getAdapter<TrusteeStaffDocument>().findOne(query);

      if (!staffMember) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee staff member with ID ${staffId} not found.`,
        });
      }

      return staffMember;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee staff member with ID ${staffId}.`,
      });
    }
  }

  async getTrusteeStaff(trusteeId: string): Promise<TrusteeStaff[]> {
    try {
      const doc = using<TrusteeStaffDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('trusteeId').equals(trusteeId),
      );
      return await this.getAdapter<TrusteeStaffDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve staff for trustee ${trusteeId}.`,
      });
    }
  }

  async createStaffMember(
    trusteeId: string,
    input: TrusteeStaffInput,
    user: CamsUserReference,
  ): Promise<TrusteeStaff> {
    const staffDocument = createAuditRecord<Creatable<TrusteeStaffDocument>>(
      {
        ...input,
        trusteeId,
        documentType: 'TRUSTEE_ASSISTANT',
      },
      user,
    );

    try {
      const id = await this.getAdapter<Creatable<TrusteeStaffDocument>>().insertOne(staffDocument);
      return { id, ...staffDocument };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee staff member for trustee ${trusteeId}.`,
      });
    }
  }

  async updateStaffMember(
    trusteeId: string,
    staffId: string,
    input: TrusteeStaffInput,
    user: CamsUserReference,
  ): Promise<TrusteeStaff> {
    try {
      const doc = using<TrusteeStaffDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('id').equals(staffId),
        doc('trusteeId').equals(trusteeId),
      );

      const existingStaffMember = await this.getAdapter<TrusteeStaffDocument>().findOne(query);

      if (!existingStaffMember) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee staff member with ID ${staffId} not found.`,
        });
      }

      const updatedStaffMember: TrusteeStaffDocument = {
        ...existingStaffMember,
        ...input,
        id: staffId,
        trusteeId,
        documentType: 'TRUSTEE_ASSISTANT',
        updatedBy: user,
        updatedOn: new Date().toISOString(),
      };

      await this.getAdapter<TrusteeStaffDocument>().replaceOne(query, updatedStaffMember);

      return updatedStaffMember;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update trustee staff member ${staffId}.`,
      });
    }
  }

  async deleteStaffMember(trusteeId: string, staffId: string): Promise<void> {
    try {
      const doc = using<TrusteeStaffDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('id').equals(staffId),
        doc('trusteeId').equals(trusteeId),
      );

      // deleteOne throws NotFoundError if deletedCount !== 1, so no need to check result
      await this.getAdapter<TrusteeStaffDocument>().deleteOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete trustee staff member ${staffId}.`,
      });
    }
  }
}
