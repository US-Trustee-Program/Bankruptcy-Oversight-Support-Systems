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

const { and, using, omit } = QueryBuilder;

export type TrusteeProfessionalIdDocument = TrusteeProfessionalId & {
  documentType: 'TRUSTEE_PROFESSIONAL_ID';
};

// Excludes the heavy evidence graph at the Mongo query level (not merely in the TypeScript
// return type) for every ordinary read - see TrusteeProfessionalIdsRepository's own doc comment.
const SUMMARY_PROJECTION = omit<TrusteeProfessionalIdDocument>('evidence');

// Only an auto-linked, non-conflicting disposition is a real trustee<->ACMS link - everything
// else is a placeholder record keyed by fingerprint, and must stay invisible to callers
// resolving real links. See TrusteeProfessionalIdsRepository's JSDoc.
function isRealLink<T extends { disposition?: unknown }>(doc: ReturnType<typeof using<T>>) {
  return doc('disposition').equals('auto-linked');
}

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
   * Writes a TrusteeProfessionalId for any pipeline outcome, keyed by (camsTrusteeId,
   * acmsProfessionalId, documentType) - a caller that retries the same record after a partial-page
   * failure (see handlePage's retry-from-original-bookmark comment) reprocesses records already
   * written within a page. Uses upsertOne (not insertOne) so a retry's newly-evaluated disposition
   * and evidence graph actually overwrite what an earlier attempt wrote for the same key, rather
   * than being silently discarded - the earlier insert-then-catch-E11000-and-return-existing
   * approach preserved the FIRST attempt's outcome forever, even when a later attempt produced a
   * richer evidence graph or escalated to 'conflict'. createdOn/createdBy are insert-only (a
   * retry never resets when the document was first created); everything else, including a fresh
   * updatedOn/updatedBy, is set on every write.
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

  /**
   * Whether this ACMS professional ID has a 'conflict'-disposition record - deliberately separate
   * from findByAcmsProfessionalId, which excludes conflict records entirely (see isRealLink). A
   * caller that only needs "should I treat this as unresolvable-forever rather than
   * not-yet-linked" (see heal-sentinel-case-appointments.ts) reads this instead of reaching into
   * the excluded-by-design population.
   */
  async hasConflictByAcmsProfessionalId(acmsProfessionalId: string): Promise<boolean> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(
        doc('acmsProfessionalId').equals(acmsProfessionalId),
        doc('disposition').equals('conflict'),
      );
      const matches = await this.getAdapter<TrusteeProfessionalIdDocument>().find(
        query,
        undefined,
        undefined,
        SUMMARY_PROJECTION,
      );
      return matches.length > 0;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to check for a conflict record with ACMS professional ID ${acmsProfessionalId}.`,
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
