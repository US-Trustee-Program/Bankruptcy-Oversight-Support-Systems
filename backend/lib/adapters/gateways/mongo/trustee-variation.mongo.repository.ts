import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeVariationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE, TrusteeVariation } from '@common/cams/trustee-variation';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-VARIATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-variation';

const { and, using } = QueryBuilder;

// Cosmos/MongoDB signals a unique-index violation via an "E11000" message; the code property
// is stripped by MongoCollectionAdapter's error handling, so detection must be message-based.
// Checks are intentionally broad to guard against driver version variance (same rationale as
// mongo-adapter.ts's isRateLimitError and the sibling trustee-match-verification repository's
// identical check).
function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Object) || !('message' in error)) {
    return false;
  }
  const message = String((error as { message: unknown }).message);
  return message.includes('E11000') || /duplicate key/i.test(message);
}

export class TrusteeVariationMongoRepository
  extends BaseMongoRepository
  implements TrusteeVariationRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeVariationMongoRepository | null = null;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeVariationMongoRepository.instance) {
      TrusteeVariationMongoRepository.instance = new TrusteeVariationMongoRepository(context);
    }
    TrusteeVariationMongoRepository.referenceCount++;
    return TrusteeVariationMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeVariationMongoRepository.referenceCount > 0) {
      TrusteeVariationMongoRepository.referenceCount--;
    }
    if (TrusteeVariationMongoRepository.referenceCount < 1) {
      TrusteeVariationMongoRepository.instance?.client.close().then();
      TrusteeVariationMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeVariationMongoRepository.dropInstance();
  }

  /**
   * Bucket fetch: returns every TRUSTEE_VARIATION sharing this fingerprint. Callers must
   * verify by comparing each document's raw `variant` against the value they're looking up
   * — the fingerprint alone is not trusted as a unique key (bucket+verify pattern).
   */
  async findByFingerprint(fingerprint: string): Promise<TrusteeVariation[]> {
    try {
      const doc = using<TrusteeVariation>();
      const query = and(
        doc('documentType').equals(TRUSTEE_VARIATION_DOCUMENT_TYPE),
        doc('fingerprint').equals(fingerprint),
      );
      return await this.getAdapter<TrusteeVariation>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee variations for fingerprint ${fingerprint}.`,
      });
    }
  }

  /**
   * Inserts a new TRUSTEE_VARIATION. Callers must have already confirmed (via
   * findByFingerprint + a variant comparison) that this exact variant hasn't been recorded
   * before — TRUSTEE_VARIATION documents are never rewritten once written. The
   * check-then-act sequence is not itself atomic, so two callers can race on the identical
   * (fingerprint, variant, documentType) unique index; the loser's insertOne throws E11000.
   * Since a TRUSTEE_VARIATION is derived purely from its (fingerprint, variant, trusteeId) —
   * never from caller-specific state — the winner's already-persisted document is exactly
   * what the loser would have written, so this returns that document instead of throwing.
   */
  async createVariation(item: Creatable<TrusteeVariation>): Promise<TrusteeVariation> {
    try {
      const id = await this.getAdapter<Creatable<TrusteeVariation>>().insertOne(item);
      return { id, ...item };
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) {
        this.context.logger.warn(
          MODULE_NAME,
          `Lost a create race for fingerprint ${item.fingerprint}, variant already recorded by a concurrent writer — returning the existing document.`,
        );
        const bucket = await this.findByFingerprint(item.fingerprint);
        const existing = bucket.find((v) => v.variant === item.variant);
        if (existing) {
          return existing;
        }
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee variation for fingerprint ${item.fingerprint}.`,
      });
    }
  }
}
