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

// Cosmos/MongoDB signals a unique-index violation via an "E11000" message; the code property
// is stripped by MongoCollectionAdapter's error handling, so detection must be message-based.
// Checks are intentionally broad to guard against driver version variance (same rationale as
// mongo-adapter.ts's isRateLimitError and the sibling trustee-variation/trustee-match-verification
// repositories' identical check).
function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Object) || !('message' in error)) {
    return false;
  }
  const message = String((error as { message: unknown }).message);
  return message.includes('E11000') || /duplicate key/i.test(message);
}

export class TrusteeProfessionalIdsMongoRepository
  extends BaseMongoRepository
  implements TrusteeProfessionalIdsRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeProfessionalIdsMongoRepository | null = null;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
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
   * failure (see handlePage's retry-from-original-bookmark comment) will hit a duplicate-key
   * violation here on the second pass. Reprocessing is expected, not a race between two different
   * callers, so this catches E11000 and returns the already-written document instead of throwing.
   * Without this, the retry's uncaught error looks non-transient to handleRateLimitRetry, gets
   * rethrown, and the message redelivers until it dead-letters - permanently stalling that group's
   * sync.
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

      const id =
        await this.getAdapter<Creatable<TrusteeProfessionalIdDocument>>().insertOne(
          auditedDocument,
        );

      return { id, ...auditedDocument };
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) {
        this.context.logger.warn(
          MODULE_NAME,
          `Professional ID record for ACMS ID ${acmsProfessionalId} already exists (reprocessed after a retry) - returning the existing document.`,
        );
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
      }
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
