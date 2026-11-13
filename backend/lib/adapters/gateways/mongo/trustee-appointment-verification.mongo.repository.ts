import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeAppointmentVerificationRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { isDuplicateKeyError } from './utils/duplicate-key-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
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
   * Marks one task resolved (status 'approved') once a refresh found a covering appointment.
   * Looked up by id within trusteeId, the shard key. Throws NotFoundError when no task matches.
   *
   * Not guarded on status or caseIds. A case that joins between the refresh's coverage check and
   * this write would be resolved with the task. Accepted: writers compute coverage from the
   * trustee's current appointments, so once a covering appointment exists new cases for this
   * tuple don't open tasks; only a writer that read appointments before the Trustee Admin's fix
   * could hit the window.
   */
  async resolve(id: string, trusteeId: string, user: CamsUserReference): Promise<void> {
    try {
      const doc = using<TrusteeAppointmentVerification>();
      const resolved = await this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(
        and(
          doc('documentType').equals(TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE),
          doc('trusteeId').equals(trusteeId),
          doc('id').equals(id),
        ),
        { $set: { status: 'approved', updatedOn: new Date().toISOString(), updatedBy: user } },
      );
      if (!resolved) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee appointment task ${id} not found.`,
        });
      }
    } catch (originalError) {
      // getCamsErrorWithStack rethrows a CamsError (the NotFoundError above) unchanged.
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
   *    resolved; without this, a new uncovered case would join a task the pending-only queue
   *    never shows. Matches nothing when the task is pending or doesn't exist.
   * 2. Open or join: findOneAndUpdate with upsert, so concurrent writers can neither create a
   *    second task for the tuple nor add a case twice ($addToSet). Two writers racing to INSERT
   *    the same tuple: the loser gets an E11000 duplicate-key error, and retrying the same upsert
   *    once then matches the winner's document.
   *
   * Two writers joining the same resolved task stay safe: only the first reopen matches (the
   * second sees status pending), and both cases then land via $addToSet. A pipeline update could
   * do both in one write, but the upsert would also have to build every insert field with
   * $cond, and Cosmos DB support for pipeline upserts is unverified.
   *
   * Accepted race: if a stale refresh resolves the task between two writers' reopens, the later
   * reopen's `$set caseIds` discards the earlier writer's case. This is accepted for the same
   * stale-writer reason as the resolve note above, and by then a covering appointment exists, so
   * the only residue is that case's matchedTrusteeAppointment flag staying false.
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
    const query = and(...keyConditions);
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
      await this.getAdapter<TrusteeAppointmentVerification>().findOneAndUpdate(reopenQuery, reopen);
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
