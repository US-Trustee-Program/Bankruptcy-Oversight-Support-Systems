import { randomUUID } from 'crypto';
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
    if ('status' in fields) conditions.push(doc('status').equals(fields.status));
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

  /**
   * Merge-upserts a TrusteeMatchVerification bucketed by fingerprint/variant. The filter only
   * matches an existing document whose status is still 'pending', so a resolved (approved or
   * rejected) task is never reached by this write at all — not even its mutable fields, let
   * alone caseId/courtId. `id`, `caseId`, `courtId`, `createdOn`, `createdBy` and `taskDate` go in
   * $setOnInsert only, so a matching update (status already 'pending') can never clear or
   * overwrite the case this task was originally opened for, or its creation record. Every other
   * field (mismatchReason, findings, source, status, etc.) is in $set, so a
   * re-sync refreshes them from the latest event.
   *
   * `id` falls back to a generated UUID on insert: callers building a new verification via
   * `createAuditRecord` never set `id`, and the Mongo client's `ignoreUndefined: true` would
   * otherwise silently drop an `undefined` key from `$setOnInsert`, leaving the new document
   * with no `id` at all.
   *
   * `_id` is dropped rather than spread into `$set`: a caller that merges `...existing` from a
   * prior read (which carries Mongo's `_id`) would otherwise write it back unchanged.
   */
  async upsertVerification(item: TrusteeMatchVerification): Promise<void> {
    try {
      const query = this.verificationQuery({
        fingerprint: item.fingerprint,
        variant: item.variant,
        status: 'pending',
      });
      const {
        id,
        caseId,
        courtId,
        createdOn,
        createdBy,
        taskDate,
        _id: _mongoId,
        ...setFields
      } = item as TrusteeMatchVerification & { _id?: unknown };
      await this.getAdapter<TrusteeMatchVerification>().findOneAndUpdate(
        query,
        {
          $set: setFields,
          $setOnInsert: {
            id: id ?? randomUUID(),
            caseId,
            courtId,
            createdOn,
            createdBy,
            taskDate,
          },
        },
        { upsert: true },
      );
    } catch (originalError) {
      if (isDuplicateKeyError(originalError)) {
        // Either a genuine concurrent writer already created the document for this
        // fingerprint/variant, or an existing document has already moved past 'pending'
        // (approved/rejected) — the filter's status:'pending' condition excludes it, so this
        // upsert attempts an insert that collides with the (fingerprint, variant, documentType)
        // unique index instead of updating it in place. Either way the write is silently
        // discarded with no other trace -- log so an unexpectedly high rate of this is visible
        // in telemetry.
        this.context.logger.warn(
          MODULE_NAME,
          `Lost an upsert for fingerprint ${item.fingerprint}, variant already recorded by a concurrent writer or a task past 'pending' — this document's field values were discarded.`,
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
      // Projection excludes Auditable fields (createdOn, createdBy, updatedOn, updatedBy) and
      // findings, which carry trustee PII and are served only by findById.
      const projection = pick<TrusteeMatchVerificationSearchResult>(
        'id',
        'documentType',
        'caseId',
        'courtId',
        'courtName',
        'dxtrTrustee',
        'mismatchReason',
        'status',
        'resolvedTrusteeId',
        'resolvedTrusteeName',
        'affectedCaseIds',
        'taskType',
        'taskDate',
        'inactiveAppointmentStatus',
        'fingerprint',
        'variant',
        'source',
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
