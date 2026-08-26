import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeProfessionalIdsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import {
  TrusteeProfessionalId,
  TrusteeProfessionalIdError,
} from '@common/cams/trustee-professional-ids';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-PROFESSIONAL-IDS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-professional-ids';

const { and, using } = QueryBuilder;

export type TrusteeProfessionalIdDocument = TrusteeProfessionalId & {
  documentType: 'TRUSTEE_PROFESSIONAL_ID';
};

// Excludes documents carrying an `error` — those are unmatched placeholder records keyed by
// fingerprint rather than a real trusteeId, and must stay invisible to callers resolving real
// trustee<->ACMS links. See TrusteeProfessionalIdsRepository's JSDoc.
function notErrored<T extends { error?: unknown }>(doc: ReturnType<typeof using<T>>) {
  return doc('error').notExists();
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

  async createProfessionalId(
    camsTrusteeId: string,
    acmsProfessionalId: string,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId> {
    try {
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

  /**
   * Writes an errored (unmatched/ambiguous/conflicting) TrusteeProfessionalId, keyed by the
   * ACMS variant's fingerprint in place of a real trusteeId. The (camsTrusteeId,
   * acmsProfessionalId, documentType) unique index still applies to this fingerprint key, so a
   * caller that retries the same record after a partial-page failure (see handlePage's
   * retry-from-original-bookmark comment) will hit a duplicate-key violation here on the
   * second pass — reprocessing is expected, not a race between two different callers, so this
   * catches E11000 and returns the already-written document instead of throwing. Without this,
   * the retry's uncaught error looks non-transient to handleRateLimitRetry, gets rethrown, and
   * the message redelivers until it dead-letters — permanently stalling that group's sync.
   */
  async createErroredProfessionalId(
    fingerprint: string,
    acmsProfessionalId: string,
    variant: string,
    error: TrusteeProfessionalIdError,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId> {
    try {
      const document = createAuditRecord<Creatable<TrusteeProfessionalIdDocument>>(
        {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: fingerprint,
          acmsProfessionalId,
          variant,
          error,
        },
        user,
      );

      const id =
        await this.getAdapter<Creatable<TrusteeProfessionalIdDocument>>().insertOne(document);

      return { id, ...document };
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) {
        this.context.logger.warn(
          MODULE_NAME,
          `Errored professional ID record for ACMS ID ${acmsProfessionalId} already exists (reprocessed after a retry) — returning the existing document.`,
        );
        const doc = using<TrusteeProfessionalIdDocument>();
        const query = and(
          doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'),
          doc('camsTrusteeId').equals(fingerprint),
          doc('acmsProfessionalId').equals(acmsProfessionalId),
        );
        const existing = await this.getAdapter<TrusteeProfessionalIdDocument>().find(query);
        if (existing.length > 0) {
          return existing[0];
        }
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create errored professional ID record for ACMS ID ${acmsProfessionalId}.`,
      });
    }
  }

  async findAll(): Promise<TrusteeProfessionalId[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(doc('documentType').equals('TRUSTEE_PROFESSIONAL_ID'), notErrored(doc));
      return await this.getAdapter<TrusteeProfessionalIdDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to load all professional ID mappings.',
      });
    }
  }

  async findByCamsTrusteeId(camsTrusteeId: string): Promise<TrusteeProfessionalId[]> {
    try {
      const doc = using<TrusteeProfessionalIdDocument>();
      const query = and(doc('camsTrusteeId').equals(camsTrusteeId), notErrored(doc));
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
      const query = and(doc('acmsProfessionalId').equals(acmsProfessionalId), notErrored(doc));
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
