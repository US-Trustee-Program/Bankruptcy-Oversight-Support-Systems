import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeMatchVerificationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import { OrderStatus } from '@common/cams/orders';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
} from '@common/cams/trustee-match-verification';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-match-verification';

const { using, and, orderBy } = QueryBuilder;

export class TrusteeMatchVerificationMongoRepository
  extends BaseMongoRepository
  implements TrusteeMatchVerificationRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeMatchVerificationMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
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

  private fromDb(doc: Record<string, unknown>): TrusteeMatchVerification {
    const { orderType, ...rest } = doc;
    return { ...rest, taskType: orderType } as unknown as TrusteeMatchVerification;
  }

  private toDb(item: TrusteeMatchVerification): Record<string, unknown> {
    const { taskType, ...rest } = item as Record<string, unknown>;
    return { ...rest, orderType: taskType };
  }

  async getVerification(caseId: string): Promise<TrusteeMatchVerification | null> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('caseId').equals(caseId),
      );
      const result = await this.getAdapter<Record<string, unknown>>().findOne(
        query as unknown as Query<Record<string, unknown>>,
      );
      return this.fromDb(result);
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
      const queryDoc = using<TrusteeMatchVerification>();
      const query = and(
        queryDoc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        queryDoc('caseId').equals(item.caseId),
      );
      await this.getAdapter<Record<string, unknown>>().replaceOne(
        query as unknown as Query<Record<string, unknown>>,
        this.toDb(item) as unknown as Record<string, unknown>,
        true,
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to upsert trustee match verification for case ${item.caseId}.`,
      });
    }
  }

  async search(predicate: { status?: OrderStatus[] }): Promise<TrusteeMatchVerification[]> {
    const { orderBy } = QueryBuilder;
    try {
      const doc = using<TrusteeMatchVerification>();
      const conditions = [doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE)];
      if (predicate?.status?.length) {
        conditions.push(doc('status').contains(predicate.status));
      }
      const results = await this.getAdapter<Record<string, unknown>>().find(
        and(...conditions) as unknown as Query<Record<string, unknown>>,
        orderBy<Record<string, unknown>>(['createdOn', 'ASCENDING']),
      );
      return results.map((d) => this.fromDb(d));
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to find trustee match verification records.',
      });
    }
  }

  async findById(id: string): Promise<TrusteeMatchVerification> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('id').equals(id),
      );
      const result = await this.getAdapter<Record<string, unknown>>().findOne(
        query as unknown as Query<Record<string, unknown>>,
      );
      return this.fromDb(result);
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
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('id').equals(id),
      );
      const existingRaw = await this.getAdapter<Record<string, unknown>>().findOne(
        query as unknown as Query<Record<string, unknown>>,
      );
      const existing = this.fromDb(existingRaw);
      const { id: _id, documentType: _documentType, ...safeUpdates } = updates;
      const merged: TrusteeMatchVerification = { ...existing, ...safeUpdates };
      await this.getAdapter<Record<string, unknown>>().replaceOne(
        query as unknown as Query<Record<string, unknown>>,
        this.toDb(merged) as unknown as Record<string, unknown>,
      );
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
      type DbQueryable = Record<string, unknown> & { _id: string };
      const doc = using<DbQueryable>();
      const conditions: ConditionOrConjunction<DbQueryable>[] = [
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('taskDate').notExists(),
      ];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<DbQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<DbQueryable>().find(query, sortSpec, limit);
      return results.map((d) => this.fromDb(d) as TrusteeMatchVerification & { _id: string });
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
}
