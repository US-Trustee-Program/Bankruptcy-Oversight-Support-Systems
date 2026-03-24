import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeProfessionalIdsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-PROFESSIONAL-IDS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-professional-ids';

const { and, using } = QueryBuilder;

export type TrusteeProfessionalIdDocument = TrusteeProfessionalId & {
  documentType: 'TRUSTEE_PROFESSIONAL_ID';
};

export class TrusteeProfessionalIdsMongoRepository
  extends BaseMongoRepository
  implements TrusteeProfessionalIdsRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeProfessionalIdsMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeProfessionalIdsMongoRepository.instance) {
      TrusteeProfessionalIdsMongoRepository.instance = new TrusteeProfessionalIdsMongoRepository(
        context,
      );
    }
    TrusteeProfessionalIdsMongoRepository.referenceCount++;
    return TrusteeProfessionalIdsMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeProfessionalIdsMongoRepository.referenceCount > 0) {
      TrusteeProfessionalIdsMongoRepository.referenceCount--;
    }
    if (TrusteeProfessionalIdsMongoRepository.referenceCount < 1) {
      TrusteeProfessionalIdsMongoRepository.instance?.client.close().then();
      TrusteeProfessionalIdsMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeProfessionalIdsMongoRepository.dropInstance();
  }

  async createProfessionalId(
    camsTrusteeId: string,
    acmsProfessionalId: string,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId> {
    try {
      // Check if this exact mapping already exists (idempotent)
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'),
        doc('camsTrusteeId').equals(camsTrusteeId),
        doc('acmsProfessionalId').equals(acmsProfessionalId),
      );

      const existing = await this.getAdapter<TrusteeProfessionalIdDocument>().find(query);

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new mapping
      const document = createAuditRecord<Creatable<TrusteeProfessionalIdDocument>>(
        {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId,
          acmsProfessionalId,
        },
        user,
      );

      const id =
        await this.getAdapter<Creatable<TrusteeProfessionalIdDocument>>().insertOne(document);

      return { id, ...document };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create professional ID mapping for trustee ${camsTrusteeId} and ACMS ID ${acmsProfessionalId}.`,
      });
    }
  }

  async findByCamsTrusteeId(camsTrusteeId: string): Promise<TrusteeProfessionalId[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = doc('camsTrusteeId').equals(camsTrusteeId);
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find professional IDs for trustee ${camsTrusteeId}.`,
      });
    }
  }

  async findByAcmsProfessionalId(acmsProfessionalId: string): Promise<TrusteeProfessionalId[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = doc('acmsProfessionalId').equals(acmsProfessionalId);
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustees with ACMS professional ID ${acmsProfessionalId}.`,
      });
    }
  }

  async deleteByCamsTrusteeId(camsTrusteeId: string): Promise<number> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = doc('camsTrusteeId').equals(camsTrusteeId);
      const deletedCount = await this.getAdapter<TrusteeProfessionalIdDocument>().deleteMany(query);

      return deletedCount;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete professional IDs for trustee ${camsTrusteeId}.`,
      });
    }
  }

  async deleteAll(): Promise<number> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID');
      return await this.getAdapter<TrusteeProfessionalIdDocument>().deleteMany(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to delete all professional IDs.',
      });
    }
  }
}
