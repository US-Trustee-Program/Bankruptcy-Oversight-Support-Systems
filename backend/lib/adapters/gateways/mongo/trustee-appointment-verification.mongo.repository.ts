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

/** How many reopen-then-upsert attempts a join makes before giving up on duplicate keys. */
const MAX_JOIN_ATTEMPTS = 3;

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
   * Marks one task resolved (status 'approved') once a refresh found a covering appointment, but
   * only if it is still pending and unchanged since the refresh read it: `expectedUpdatedOn` must
   * equal the stored updatedOn. Every join bumps updatedOn, so a case that joined after the read
   * makes this match nothing and return false; the refresh then re-reads the task and covers the
   * new case. Looked up by id within trusteeId, the shard key.
   */
  async resolve(
    id: string,
    trusteeId: string,
    expectedUpdatedOn: string,
    user: CamsUserReference,
  ): Promise<boolean> {
    try {
      const doc = using<TrusteeAppointmentVerification>();
      const resolved = await this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(
        and(
          doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
          doc('trusteeId').equals(trusteeId),
          doc('id').equals(id),
          doc('status').equals('pending'),
          doc('updatedOn').equals(expectedUpdatedOn),
        ),
        { $set: { status: 'approved', updatedOn: new Date().toISOString(), updatedBy: user } },
      );
      return !!resolved;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to resolve trustee appointment task ${id}.`,
      });
    }
  }

  /**
   * Two writes keyed by the collection's unique index (documentType + trusteeId + courtId +
   * divisionCode + chapter):
   *
   * 1. Reopen: if the tuple's task is no longer pending (a refresh resolved it), set it back to
   *    pending with caseIds reset to just this case. The cases it held were verified when it
   *    resolved. Matches nothing when the task is pending or doesn't exist.
   * 2. Open or join: findOneAndUpdate with upsert on the tuple's PENDING task, so concurrent
   *    writers can neither create a second task for the tuple nor add a case twice ($addToSet),
   *    and a case never lands on a resolved task the pending-only queue would hide.
   *
   * A duplicate-key error on the upsert means the tuple's task exists but isn't pending (a
   * refresh resolved it after step 1) or a concurrent writer inserted it first. Either way the
   * whole sequence is retried from step 1, up to MAX_JOIN_ATTEMPTS times.
   *
   * Two writers joining the same resolved task stay safe: only the first reopen matches (the
   * second sees status pending), and both cases then land via $addToSet. A pipeline update could
   * do both in one write, but the upsert would also have to build every insert field with
   * $cond, and Cosmos DB support for pipeline upserts is unverified.
   */
  async openOrJoin(
    key: AppointmentTaskKey,
    caseId: string,
    reason: AppointmentTaskReason,
    user: CamsUserReference,
  ): Promise<void> {
    const doc = using<TrusteeAppointmentVerification>();
    const keyConditions = [
      doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
      doc('trusteeId').equals(key.trusteeId),
      doc('courtId').equals(key.courtId),
      doc('divisionCode').equals(key.divisionCode),
      doc('chapter').equals(key.chapter),
    ];
    const query = and(...keyConditions, doc('status').equals('pending'));
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
    const reopenQuery = and(...keyConditions, doc('status').notEqual('pending'));
    const reopen = {
      $set: { status: 'pending', caseIds: [caseId], reason, updatedOn: now, updatedBy: user },
    };
    const upsert = () =>
      this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(query, update, {
        upsert: true,
      });

    try {
      for (let attempt = 1; ; attempt++) {
        await this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(
          reopenQuery,
          reopen,
        );
        try {
          await upsert();
          return;
        } catch (error) {
          if (!isDuplicateKeyError(error) || attempt >= MAX_JOIN_ATTEMPTS) throw error;
        }
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to open or join trustee appointment task for trustee ${key.trusteeId}, court ${key.courtId}, division ${key.divisionCode}, chapter ${key.chapter} (case ${caseId}).`,
      });
    }
  }
}
