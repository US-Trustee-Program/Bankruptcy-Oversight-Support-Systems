import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import {
  TrusteeMatchVerificationRepository,
  UpdateResult,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction, Query } from '../../../query/query-builder';
import { OrderStatus } from '@common/cams/orders';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
  TrusteeMatchVerificationSearchResult,
} from '@common/cams/trustee-match-verification';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-match-verification';

const { using, and, orderBy, pick } = QueryBuilder;

// Cosmos/MongoDB signals a unique-index violation via an "E11000" message; the code property
// is stripped by MongoCollectionAdapter's error handling, so detection must be message-based.
// Checks are intentionally broad to guard against driver version variance (same rationale as
// mongo-adapter.ts's isRateLimitError).
function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Object) || !('message' in error)) {
    return false;
  }
  const message = String((error as { message: unknown }).message);
  return message.includes('E11000') || /duplicate key/i.test(message);
}

export class TrusteeMatchVerificationMongoRepository
  extends BaseMongoRepository
  implements TrusteeMatchVerificationRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeMatchVerificationMongoRepository | null = null;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
    this.context = context;
  }

  public static getInstance(context: ApplicationContext): TrusteeMatchVerificationMongoRepository {
    if (!TrusteeMatchVerificationMongoRepository.instance) {
      TrusteeMatchVerificationMongoRepository.instance =
        new TrusteeMatchVerificationMongoRepository(context);
    }
    TrusteeMatchVerificationMongoRepository.referenceCount++;
    return TrusteeMatchVerificationMongoRepository.instance;
  }

  public static dropInstance(): void {
    if (TrusteeMatchVerificationMongoRepository.referenceCount > 0) {
      TrusteeMatchVerificationMongoRepository.referenceCount--;
    }
    if (TrusteeMatchVerificationMongoRepository.referenceCount < 1) {
      TrusteeMatchVerificationMongoRepository.instance?.client.close().then();
      TrusteeMatchVerificationMongoRepository.instance = null;
    }
  }

  public release(): void {
    TrusteeMatchVerificationMongoRepository.dropInstance();
  }

  private verificationQuery(
    fields: Partial<TrusteeMatchVerification>,
  ): Query<TrusteeMatchVerification> {
    const doc = using<TrusteeMatchVerification>();
    const conditions = [doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE)];
    if ('caseId' in fields) conditions.push(doc('caseId').equals(fields.caseId));
    if ('id' in fields) conditions.push(doc('id').equals(fields.id));
    if ('fingerprint' in fields) conditions.push(doc('fingerprint').equals(fields.fingerprint));
    if ('variant' in fields) conditions.push(doc('variant').equals(fields.variant));
    return and(...conditions);
  }

  /**
   * Bucket fetch: returns every TrusteeMatchVerification sharing this fingerprint. Callers
   * must verify by comparing each document's raw `variant` against the value they're looking
   * up — the fingerprint alone is not trusted as a unique key (bucket+verify pattern).
   */
  async findByFingerprint(fingerprint: string): Promise<TrusteeMatchVerification[]> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('fingerprint').equals(fingerprint),
      );
      return await this.getAdapter<TrusteeMatchVerification>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee match verifications for fingerprint ${fingerprint}.`,
      });
    }
  }

  async getVerification(caseId: string): Promise<TrusteeMatchVerification | null> {
    try {
      const query = this.verificationQuery({ caseId });
      const result = await this.getAdapter<TrusteeMatchVerification>().findOne(query);
      return result;
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee match verification for case ${caseId}.`,
      });
    }
  }

  async upsertVerification(item: TrusteeMatchVerification): Promise<void> {
    try {
      const query = this.verificationQuery({
        fingerprint: item.fingerprint,
        variant: item.variant,
      });
      await this.getAdapter<TrusteeMatchVerification>().replaceOne(query, item, true);
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) {
        // The racing documents are not guaranteed identical (taskDate, reason, updatedOn may
        // differ), so the loser's field values are silently discarded here with no other trace
        // -- log so an unexpectedly high rate of this is visible in telemetry.
        this.context.logger.warn(
          MODULE_NAME,
          `Lost an upsert race for fingerprint ${item.fingerprint}, variant already recorded by a concurrent writer — this document's field values were discarded.`,
        );
        return;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to upsert trustee match verification for fingerprint ${item.fingerprint}.`,
      });
    }
  }

  async search(predicate: {
    status?: OrderStatus[];
  }): Promise<TrusteeMatchVerificationSearchResult[]> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const conditions: ConditionOrConjunction<TrusteeMatchVerification>[] = [
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
      ];
      if (predicate?.status?.length) {
        conditions.push(doc('status').contains(predicate.status));
      }
      // Projection excludes Auditable fields (createdOn, createdBy, updatedOn, updatedBy).
      // matchCandidates is included so the use-case can compute candidateCount and
      // preselectedCandidate; it is stripped from the response after mapping to TrusteeMatchVerificationListItem.
      const projection = pick<TrusteeMatchVerificationSearchResult>(
        'id',
        'documentType',
        'caseId',
        'courtId',
        'courtName',
        'dxtrTrustee',
        'mismatchReason',
        'matchCandidates',
        'status',
        'resolvedTrusteeId',
        'resolvedTrusteeName',
        'resolvedCaseIds',
        'taskType',
        'taskDate',
        'reason',
        'inactiveAppointmentStatus',
        'fingerprint',
        'variant',
      );
      return (await this.getAdapter<TrusteeMatchVerification>().find(
        and(...conditions),
        orderBy<TrusteeMatchVerification>(['taskDate', 'ASCENDING']),
        undefined,
        projection,
      )) as TrusteeMatchVerificationSearchResult[];
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to find trustee match verification records.',
      });
    }
  }

  async findById(id: string): Promise<TrusteeMatchVerification> {
    try {
      const query = this.verificationQuery({ id });
      const result = await this.getAdapter<TrusteeMatchVerification>().findOne(query);
      return result;
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        throw originalError;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee match verification ${id}.`,
      });
    }
  }

  async update(
    id: string,
    updates: Partial<TrusteeMatchVerification>,
  ): Promise<TrusteeMatchVerification> {
    try {
      const query = this.verificationQuery({ id });
      const existing = await this.getAdapter<TrusteeMatchVerification>().findOne(query);
      const { id: _id, documentType: _documentType, ...safeUpdates } = updates;
      const merged: TrusteeMatchVerification = { ...existing, ...safeUpdates };
      await this.getAdapter<TrusteeMatchVerification>().replaceOne(query, merged);
      return merged;
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        throw originalError;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update trustee match verification ${id}.`,
      });
    }
  }

  async findVerificationsMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<TrusteeMatchVerification & { _id: string }>> {
    try {
      type VerificationQueryable = TrusteeMatchVerification & { _id: string };
      const doc = using<VerificationQueryable>();
      const conditions: ConditionOrConjunction<VerificationQueryable>[] = [
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('taskDate').notExists(),
      ];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<VerificationQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<VerificationQueryable>().find(query, sortSpec, limit);
      return results;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to find trustee match verifications missing taskDate.',
      });
    }
  }

  async updateVerificationTaskDate(mongoId: string, taskDate: string): Promise<void> {
    try {
      type VerificationQueryable = TrusteeMatchVerification & { _id: string };
      const query = using<VerificationQueryable>()('_id').equals(mongoId);
      await this.getAdapter<VerificationQueryable>().updateOne(query, {
        taskDate,
      } as Partial<VerificationQueryable>);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update taskDate on trustee match verification ${mongoId}.`,
      });
    }
  }

  public async updateManyByQuery<U>(
    query: ConditionOrConjunction<U>,
    update: object,
  ): Promise<UpdateResult> {
    try {
      return await this.getAdapter<U>().updateMany(query, update);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to bulk-update trustee match verification documents.',
      });
    }
  }
}
