import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeProfessionalIdsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import {
  TrusteeProfessionalId,
  TrusteeProfessionalIdSummary,
} from '../../../use-cases/dataflows/trustee-professional-ids.types';
import { Auditable, createAuditRecord } from '@common/cams/auditable';
import { Identifiable } from '@common/cams/document';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';
import { UnknownError } from '../../../common-errors/unknown-error';

const MODULE_NAME = 'TRUSTEE-PROFESSIONAL-IDS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-professional-ids';

const { and, using, omit, orderBy } = QueryBuilder;

/** Stored shape of a TrusteeProfessionalId in the trustee-professional-ids collection. */
export type TrusteeProfessionalIdDocument = TrusteeProfessionalId & {
  documentType: 'TRUSTEE_PROFESSIONAL_ID';
};

// Excludes evidence at the Mongo query level for every ordinary read.
const SUMMARY_PROJECTION = omit<TrusteeProfessionalIdDocument>('evidence');

// Only disposition 'linked' is a real link; other dispositions are hidden from these finders.
function isRealLink<T extends { disposition?: unknown }>(doc: ReturnType<typeof using<T>>) {
  return doc('disposition').equals('linked');
}

/** Mongo-backed TrusteeProfessionalIdsRepository. */
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

  /**
   * Upserts on (documentType, camsTrusteeId, acmsProfessionalId); a retry overwrites the prior
   * outcome; createdOn/createdBy/id are insert-only.
   */
  async upsertProfessionalId(
    document: Omit<TrusteeProfessionalId, keyof Auditable | keyof Identifiable>,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId> {
    const { camsTrusteeId, acmsProfessionalId } = document;
    try {
      const auditedDocument = createAuditRecord<Creatable<TrusteeProfessionalIdDocument>>(
        document,
        user,
      );
      const { createdOn, createdBy, ...setFields } = auditedDocument;

      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'),
        doc('camsTrusteeId').equals(camsTrusteeId),
        doc('acmsProfessionalId').equals(acmsProfessionalId),
      );
      const adapter = this.getAdapter<TrusteeProfessionalIdDocument>();
      const written = await adapter.findOneAndUpdate(
        query,
        { $set: setFields, $setOnInsert: { createdOn, createdBy, id: randomUUID() } },
        { upsert: true, returnDocument: 'after' },
      );
      if (!written) {
        throw new UnknownError(MODULE_NAME, {
          message: `upsertProfessionalId returned no document for trustee ${camsTrusteeId} and ACMS ID ${acmsProfessionalId}.`,
        });
      }
      return written;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write professional ID record for trustee ${camsTrusteeId} and ACMS ID ${acmsProfessionalId}.`,
      });
    }
  }

  async findAll(): Promise<TrusteeProfessionalIdSummary[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'), isRealLink(doc));
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(
        query,
        undefined,
        undefined,
        SUMMARY_PROJECTION,
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to load all professional ID mappings.',
      });
    }
  }

  async findByCamsTrusteeId(camsTrusteeId: string): Promise<TrusteeProfessionalIdSummary[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(doc('camsTrusteeId').equals(camsTrusteeId), isRealLink(doc));
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(
        query,
        undefined,
        undefined,
        SUMMARY_PROJECTION,
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find professional IDs for trustee ${camsTrusteeId}.`,
      });
    }
  }

  async findByAcmsProfessionalId(
    acmsProfessionalId: string,
  ): Promise<TrusteeProfessionalIdSummary[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(doc('acmsProfessionalId').equals(acmsProfessionalId), isRealLink(doc));
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(
        query,
        undefined,
        undefined,
        SUMMARY_PROJECTION,
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustees with ACMS professional ID ${acmsProfessionalId}.`,
      });
    }
  }

  async findLinkedForSentinelHeal(
    lastId: string | null,
    limit: number,
    includeHealed = false,
  ): Promise<Array<TrusteeProfessionalIdSummary & { _id: string }>> {
    type Queryable = TrusteeProfessionalIdDocument & { _id: string };
    try {
      const doc = using<Queryable>();
      const conditions = [doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'), isRealLink(doc)];
      if (!includeHealed) conditions.push(doc('sentinelsHealedOn').notExists());
      if (lastId) conditions.push(doc('_id').greaterThan(lastId));
      return await this.getAdapter<Queryable>().find(
        and(...conditions),
        orderBy<Queryable>(['_id', 'ASCENDING']),
        limit,
        omit<Queryable>('evidence'),
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to find linked professional IDs for sentinel healing.',
      });
    }
  }

  async markSentinelsHealed(camsTrusteeId: string, acmsProfessionalId: string): Promise<void> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'),
        doc('camsTrusteeId').equals(camsTrusteeId),
        doc('acmsProfessionalId').equals(acmsProfessionalId),
      );
      await this.getAdapter<TrusteeProfessionalIdDocument>().updateOne(query, {
        sentinelsHealedOn: new Date().toISOString(),
      });
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to mark sentinels healed for trustee ${camsTrusteeId} and ACMS ID ${acmsProfessionalId}.`,
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
