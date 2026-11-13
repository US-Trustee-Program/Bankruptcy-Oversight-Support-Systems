import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeAppointmentVerificationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { isDuplicateKeyError } from './utils/duplicate-key-error';
import QueryBuilder from '../../../query/query-builder';
import {
  AppointmentTaskKey,
  AppointmentTaskReason,
  TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE,
  TrusteeAppointmentVerification,
} from '@common/cams/trustee-appointment-verification';
import { CamsUserReference } from '@common/cams/users';
import { OrderStatus } from '@common/cams/orders';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-VERIFICATION-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-appointment-verification';

const { using, and } = QueryBuilder;

export class TrusteeAppointmentVerificationMongoRepository
  extends BaseMongoRepository
  implements TrusteeAppointmentVerificationRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeAppointmentVerificationMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(
    context: ApplicationContext,
  ): TrusteeAppointmentVerificationMongoRepository {
    if (!TrusteeAppointmentVerificationMongoRepository.instance) {
      TrusteeAppointmentVerificationMongoRepository.instance =
        new TrusteeAppointmentVerificationMongoRepository(context);
    }
    TrusteeAppointmentVerificationMongoRepository.referenceCount++;
    return TrusteeAppointmentVerificationMongoRepository.instance;
  }

  public static dropInstance(): void {
    if (TrusteeAppointmentVerificationMongoRepository.referenceCount > 0) {
      TrusteeAppointmentVerificationMongoRepository.referenceCount--;
    }
    if (TrusteeAppointmentVerificationMongoRepository.referenceCount < 1) {
      TrusteeAppointmentVerificationMongoRepository.instance?.client.close().then();
      TrusteeAppointmentVerificationMongoRepository.instance = null;
    }
  }

  public release(): void {
    TrusteeAppointmentVerificationMongoRepository.dropInstance();
  }

  /**
   * Unsorted: the collection indexes only _id and the task key, and Cosmos cannot sort on an
   * unindexed field. The Data Verification queue sorts every task type by task date itself.
   */
  async search(predicate: { status: OrderStatus[] }): Promise<TrusteeAppointmentVerification[]> {
    try {
      const doc = using<TrusteeAppointmentVerification>();
      return await this.getAdapter<TrusteeAppointmentVerification>().find(
        and(
          doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
          doc('status').contains(predicate.status),
        ),
      );
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to find trustee appointment tasks.',
      });
    }
  }

  /**
   * The single task by id, for the detail view. trusteeId is the collection's shard key, so the
   * lookup targets one partition instead of fanning out across all of them.
   */
  async findById(id: string, trusteeId: string): Promise<TrusteeAppointmentVerification> {
    try {
      const doc = using<TrusteeAppointmentVerification>();
      return await this.getAdapter<TrusteeAppointmentVerification>().findOne(
        and(
          doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
          doc('trusteeId').equals(trusteeId),
          doc('id').equals(id),
        ),
      );
    } catch (originalError) {
      // getCamsErrorWithStack already rethrows a CamsError (e.g. NotFoundError) unchanged, the
      // same guarantee openOrJoin relies on for TooManyRequestsError below.
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee appointment task ${id}.`,
      });
    }
  }

  /**
   * One findOneAndUpdate with upsert, keyed by the collection's unique index (documentType +
   * trusteeId + courtId + divisionCode + chapter), so concurrent writers can neither create a
   * second task for the tuple nor add a case twice ($addToSet). Two writers racing to INSERT the
   * same tuple: the loser gets an E11000 duplicate-key error, and retrying the same upsert once
   * then matches the winner's document.
   */
  async openOrJoin(
    key: AppointmentTaskKey,
    caseId: string,
    reason: AppointmentTaskReason,
    user: CamsUserReference,
  ): Promise<void> {
    const doc = using<TrusteeAppointmentVerification>();
    const query = and(
      doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
      doc('trusteeId').equals(key.trusteeId),
      doc('courtId').equals(key.courtId),
      doc('divisionCode').equals(key.divisionCode),
      doc('chapter').equals(key.chapter),
    );
    const now = new Date().toISOString();
    const update = {
      $addToSet: { caseIds: caseId },
      $set: { reason, updatedOn: now, updatedBy: user },
      // Key fields are set explicitly rather than relying on the server copying equality
      // conditions from an $and filter into the inserted document.
      $setOnInsert: {
        id: randomUUID(),
        documentType: TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE,
        ...key,
        taskType: 'trustee-appointment',
        status: 'pending',
        createdOn: now,
        createdBy: user,
      },
    };
    const upsert = () =>
      this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(query, update, {
        upsert: true,
      });

    try {
      try {
        await upsert();
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        await upsert();
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to open or join trustee appointment task for trustee ${key.trusteeId}, court ${key.courtId}, division ${key.divisionCode}, chapter ${key.chapter} (case ${caseId}).`,
      });
    }
  }
}
