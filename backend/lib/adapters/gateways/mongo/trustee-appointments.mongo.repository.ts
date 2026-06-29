import { ApplicationContext } from '../../types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import {
  TrusteeAppointmentsRepository,
  TrusteeDueDateMetricsAggregation,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AppointmentStatus } from '@common/cams/trustees';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-appointments';

const { using, and } = QueryBuilder;

export type TrusteeAppointmentDocument = TrusteeAppointment & {
  documentType: 'TRUSTEE_APPOINTMENT';
};

export class TrusteeAppointmentsMongoRepository
  extends BaseMongoRepository
  implements TrusteeAppointmentsRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeAppointmentsMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeAppointmentsMongoRepository.instance) {
      TrusteeAppointmentsMongoRepository.instance = new TrusteeAppointmentsMongoRepository(context);
    }
    TrusteeAppointmentsMongoRepository.referenceCount++;
    return TrusteeAppointmentsMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeAppointmentsMongoRepository.referenceCount > 0) {
      TrusteeAppointmentsMongoRepository.referenceCount--;
    }
    if (TrusteeAppointmentsMongoRepository.referenceCount < 1) {
      TrusteeAppointmentsMongoRepository.instance?.client.close().then();
      TrusteeAppointmentsMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeAppointmentsMongoRepository.dropInstance();
  }

  async read(trusteeId: string, appointmentId: string): Promise<TrusteeAppointment> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('id').equals(appointmentId),
        doc('trusteeId').equals(trusteeId),
      );
      const appointment = await this.getAdapter<TrusteeAppointmentDocument>().findOne(query);

      if (!appointment) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee appointment with ID ${appointmentId} not found.`,
        });
      }

      return appointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee appointment with ID ${appointmentId}.`,
      });
    }
  }

  async getTrusteeAppointments(trusteeId: string): Promise<TrusteeAppointment[]> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('trusteeId').equals(trusteeId),
      );
      return await this.getAdapter<TrusteeAppointmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve appointments for trustee ${trusteeId}.`,
      });
    }
  }

  async getAppointmentsByTrusteeIds(trusteeIds: string[]): Promise<TrusteeAppointment[]> {
    if (trusteeIds.length === 0) return [];
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('trusteeId').contains(trusteeIds),
      );
      return await this.getAdapter<TrusteeAppointmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to retrieve appointments for multiple trustees.',
      });
    }
  }

  async getTrusteeIdsByStatuses(statuses: AppointmentStatus[]): Promise<string[]> {
    if (statuses.length === 0) return [];
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('status').contains(statuses),
      );
      const appointments = await this.getAdapter<TrusteeAppointmentDocument>().find(query);
      return [...new Set(appointments.map((appt) => appt.trusteeId))];
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to retrieve trustee IDs by appointment status.',
      });
    }
  }

  async createAppointment(
    trusteeId: string,
    appointmentInput: TrusteeAppointmentInput,
    user: CamsUserReference,
  ): Promise<TrusteeAppointment> {
    const appointmentDocument = createAuditRecord<Creatable<TrusteeAppointmentDocument>>(
      {
        ...appointmentInput,
        trusteeId,
        documentType: 'TRUSTEE_APPOINTMENT',
      },
      user,
    );

    try {
      const id =
        await this.getAdapter<Creatable<TrusteeAppointmentDocument>>().insertOne(
          appointmentDocument,
        );
      return { id, ...appointmentDocument };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee appointment for trustee ${trusteeId}.`,
      });
    }
  }

  async updateAppointment(
    trusteeId: string,
    appointmentId: string,
    appointmentInput: TrusteeAppointmentInput,
    user: CamsUserReference,
  ): Promise<TrusteeAppointment> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('id').equals(appointmentId),
        doc('trusteeId').equals(trusteeId),
      );

      const existingAppointment =
        await this.getAdapter<TrusteeAppointmentDocument>().findOne(query);

      if (!existingAppointment) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee appointment with ID ${appointmentId} not found.`,
        });
      }

      const updatedAppointment: TrusteeAppointmentDocument = {
        ...existingAppointment,
        ...appointmentInput,
        id: appointmentId,
        documentType: 'TRUSTEE_APPOINTMENT',
        updatedBy: user,
        updatedOn: new Date().toISOString(),
      };

      await this.getAdapter<TrusteeAppointmentDocument>().replaceOne(query, updatedAppointment);

      return updatedAppointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update trustee appointment with ID ${appointmentId}.`,
      });
    }
  }

  async findByCursor<T>(
    query: ConditionOrConjunction<T>,
    options: { limit: number; sortField: keyof T; sortDirection: 'ASCENDING' | 'DESCENDING' },
  ): Promise<T[]> {
    try {
      const sortSpec = QueryBuilder.orderBy<T>([options.sortField, options.sortDirection]);
      const adapter = this.getAdapter<T>();
      return await adapter.find(query, sortSpec, options.limit);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getChapter7DueDateMetricsAggregation(): Promise<TrusteeDueDateMetricsAggregation> {
    try {
      const TOTAL_REQUIRED_FIELDS = 8;

      const pipeline = [
        { $match: { documentType: 'TRUSTEE_APPOINTMENT', chapter: '7' } },
        {
          $lookup: {
            from: 'trustees',
            localField: 'id',
            foreignField: 'appointmentId',
            as: 'keyDates',
          },
        },
        {
          $addFields: {
            keyDoc: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$keyDates',
                    as: 'kd',
                    cond: { $eq: ['$$kd.documentType', 'TRUSTEE_UPCOMING_REPORT_DATES'] },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            hasTprReviewPeriod: {
              $and: [
                { $ifNull: ['$keyDoc.tprReviewPeriodStart', false] },
                { $ifNull: ['$keyDoc.tprReviewPeriodEnd', false] },
              ],
            },
            hasPastFieldExam: { $ifNull: ['$keyDoc.pastFieldExam', false] },
            hasPastAudit: { $ifNull: ['$keyDoc.pastAudit', false] },
            hasTirReviewPeriod: {
              $and: [
                { $ifNull: ['$keyDoc.tirReviewPeriodStart', false] },
                { $ifNull: ['$keyDoc.tirReviewPeriodEnd', false] },
              ],
            },
            hasTprDue: { $ifNull: ['$keyDoc.tprDue', false] },
            hasUpcomingExamOrAuditYear: { $ifNull: ['$keyDoc.upcomingExamOrAuditYear', false] },
            hasLastAuditFiscalYear: { $ifNull: ['$keyDoc.lastAuditFiscalYear', false] },
            hasTirFrequency: { $ifNull: ['$keyDoc.tirFrequency', false] },
            hasTirSubmission: { $ifNull: ['$keyDoc.tirSubmission', false] },
            hasTirReview: { $ifNull: ['$keyDoc.tirReview', false] },
          },
        },
        {
          $addFields: {
            fieldCount: {
              $sum: [
                { $cond: ['$hasTprReviewPeriod', 1, 0] },
                { $cond: ['$hasPastFieldExam', 1, 0] },
                { $cond: ['$hasPastAudit', 1, 0] },
                { $cond: ['$hasTirReviewPeriod', 1, 0] },
                { $cond: ['$hasTprDue', 1, 0] },
                { $cond: ['$hasUpcomingExamOrAuditYear', 1, 0] },
                { $cond: ['$hasTirSubmission', 1, 0] },
                { $cond: ['$hasTirReview', 1, 0] },
              ],
            },
          },
        },
        {
          $addFields: {
            completeness: {
              $switch: {
                branches: [
                  { case: { $eq: ['$fieldCount', TOTAL_REQUIRED_FIELDS] }, then: 'complete' },
                  { case: { $gt: ['$fieldCount', 0] }, then: 'partial' },
                ],
                default: 'none',
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalChapter7Appointments: { $sum: 1 },
            completeCount: { $sum: { $cond: [{ $eq: ['$completeness', 'complete'] }, 1, 0] } },
            partialCount: { $sum: { $cond: [{ $eq: ['$completeness', 'partial'] }, 1, 0] } },
            noneCount: { $sum: { $cond: [{ $eq: ['$completeness', 'none'] }, 1, 0] } },
            tprReviewPeriodCount: { $sum: { $cond: ['$hasTprReviewPeriod', 1, 0] } },
            pastFieldExamCount: { $sum: { $cond: ['$hasPastFieldExam', 1, 0] } },
            pastAuditCount: { $sum: { $cond: ['$hasPastAudit', 1, 0] } },
            tirReviewPeriodCount: { $sum: { $cond: ['$hasTirReviewPeriod', 1, 0] } },
            tprDueDateCount: { $sum: { $cond: ['$hasTprDue', 1, 0] } },
            upcomingExamOrAuditYearCount: {
              $sum: { $cond: ['$hasUpcomingExamOrAuditYear', 1, 0] },
            },
            lastAuditFiscalYearCount: { $sum: { $cond: ['$hasLastAuditFiscalYear', 1, 0] } },
            tirFrequencyCount: { $sum: { $cond: ['$hasTirFrequency', 1, 0] } },
            tirSubmissionCount: { $sum: { $cond: ['$hasTirSubmission', 1, 0] } },
            tirReviewDueDateCount: { $sum: { $cond: ['$hasTirReview', 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalChapter7Appointments: 1,
            completeCount: 1,
            partialCount: 1,
            noneCount: 1,
            tprReviewPeriodCount: 1,
            pastFieldExamCount: 1,
            pastAuditCount: 1,
            tirReviewPeriodCount: 1,
            tprDueDateCount: 1,
            upcomingExamOrAuditYearCount: 1,
            lastAuditFiscalYearCount: 1,
            tirFrequencyCount: 1,
            tirSubmissionCount: 1,
            tirReviewDueDateCount: 1,
          },
        },
      ];

      const collection = this.client.database(this.databaseName).collection(this.collectionName);
      const cursor = await collection.aggregate(pipeline);
      const results = [];
      for await (const result of cursor) {
        results.push(result);
      }

      if (results.length === 0) {
        return {
          totalChapter7Appointments: 0,
          completeCount: 0,
          partialCount: 0,
          noneCount: 0,
          tprReviewPeriodCount: 0,
          pastFieldExamCount: 0,
          pastAuditCount: 0,
          tirReviewPeriodCount: 0,
          tprDueDateCount: 0,
          upcomingExamOrAuditYearCount: 0,
          lastAuditFiscalYearCount: 0,
          tirFrequencyCount: 0,
          tirSubmissionCount: 0,
          tirReviewDueDateCount: 0,
        };
      }

      return results[0] as TrusteeDueDateMetricsAggregation;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to compute Chapter 7 due date metrics aggregation.',
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = doc('id').equals(id);
      await this.getAdapter<TrusteeAppointmentDocument>().deleteOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete trustee appointment ${id}.`,
      });
    }
  }

  async deleteAll(): Promise<number> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = doc('documentType').equals('TRUSTEE_APPOINTMENT');
      return await this.getAdapter<TrusteeAppointmentDocument>().deleteMany(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to delete all trustee appointments.',
      });
    }
  }
}
