import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeMatchVerificationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
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

  async getVerification(caseId: string): Promise<TrusteeMatchVerification | null> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const query = and(
        doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        doc('caseId').equals(caseId),
      );
      return await this.getAdapter<TrusteeMatchVerification>().findOne(query);
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee match verification for case ${caseId}.`,
      });
    }
  }

  async upsertVerification(doc: TrusteeMatchVerification): Promise<void> {
    try {
      const queryDoc = using<TrusteeMatchVerification>();
      const query = and(
        queryDoc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE),
        queryDoc('caseId').equals(doc.caseId),
      );
      await this.getAdapter<TrusteeMatchVerification>().replaceOne(query, doc, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to upsert trustee match verification for case ${doc.caseId}.`,
      });
    }
  }

  async search(predicate?: { status?: OrderStatus[] }): Promise<TrusteeMatchVerification[]> {
    try {
      const doc = using<TrusteeMatchVerification>();
      const conditions = [doc('documentType').equals(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE)];
      if (predicate?.status?.length) {
        conditions.push(doc('status').contains(predicate.status));
      }
      const query = and(...conditions);
      return await this.getAdapter<TrusteeMatchVerification>().find(
        query,
        orderBy(['createdOn', 'ASCENDING']),
      );
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
      return await this.getAdapter<TrusteeMatchVerification>().findOne(query);
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
}
