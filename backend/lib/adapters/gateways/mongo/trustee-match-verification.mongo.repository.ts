import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeMatchVerificationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction, Query } from '../../../query/query-builder';
import { OrderStatus } from '@common/cams/orders';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
} from '@common/cams/trustee-match-verification';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-match-verification';

const { using, and, orderBy } = QueryBuilder;

// MongoDB document shape: orderType replaces taskType in the domain model
type TrusteeMatchVerificationDb = Omit<TrusteeMatchVerification, 'taskType'> & {
  orderType: TrusteeMatchVerification['taskType'];
};
type TrusteeMatchVerificationDbQueryable = TrusteeMatchVerificationDb & { _id: string };

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

  private fromDb(doc: TrusteeMatchVerificationDb): TrusteeMatchVerification {
    const { orderType, ...rest } = doc;
    if (orderType !== undefined) {
      return { ...rest, taskType: orderType } as TrusteeMatchVerification;
    }
    return rest as TrusteeMatchVerification;
  }

  private toDb(item: TrusteeMatchVerification): TrusteeMatchVerificationDb {
    const { taskType, ...rest } = item;
    return { ...rest, orderType: taskType };
  }

  async getVerification(caseId: string): Promise<TrusteeMatchVerification | null> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('caseId').equals(caseId),
      );
      const result = await this.getAdapter<TrusteeMatchVerificationDb>().findOne(
        query as unknown as Query<TrusteeMatchVerificationDb>,
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
      await this.getAdapter<TrusteeMatchVerificationDb>().replaceOne(
        query as unknown as Query<TrusteeMatchVerificationDb>,
        this.toDb(item),
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
      const results = await this.getAdapter<TrusteeMatchVerificationDb>().find(
        and(...conditions) as unknown as Query<TrusteeMatchVerificationDb>,
        orderBy<TrusteeMatchVerificationDb>(['createdOn', 'ASCENDING']),
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
      const result = await this.getAdapter<TrusteeMatchVerificationDb>().findOne(
        query as unknown as Query<TrusteeMatchVerificationDb>,
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
      const existingRaw = await this.getAdapter<TrusteeMatchVerificationDb>().findOne(
        query as unknown as Query<TrusteeMatchVerificationDb>,
      );
      const existing = this.fromDb(existingRaw);
      const { id: _id, documentType: _documentType, ...safeUpdates } = updates;
      const merged: TrusteeMatchVerification = { ...existing, ...safeUpdates };
      await this.getAdapter<TrusteeMatchVerificationDb>().replaceOne(
        query as unknown as Query<TrusteeMatchVerificationDb>,
        this.toDb(merged),
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
      const doc = using<TrusteeMatchVerificationDbQueryable>();
      const conditions: ConditionOrConjunction<TrusteeMatchVerificationDbQueryable>[] = [
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('taskDate').notExists(),
      ];
      if (lastId) {
        conditions.push(doc('_id').greaterThan(lastId));
      }
      const query = and(...conditions);
      const sortSpec = orderBy<TrusteeMatchVerificationDbQueryable>(['_id', 'ASCENDING']);
      const results = await this.getAdapter<TrusteeMatchVerificationDbQueryable>().find(
        query,
        sortSpec,
        limit,
      );
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
