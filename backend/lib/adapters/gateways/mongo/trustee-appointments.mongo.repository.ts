import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import {
  TrusteeAppointmentsRepository,
  TrusteeDueDateMetricsAggregation,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import {
  CaseAppointment,
  CaseAppointmentInput,
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '@common/cams/trustee-appointments';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-appointments';

const { using, and } = QueryBuilder;

export type TrusteeAppointmentDocument = TrusteeAppointment & {
  documentType: 'TRUSTEE_APPOINTMENT';
};

export type CaseAppointmentDocument = CaseAppointment & {
  documentType: 'CASE_APPOINTMENT';
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

  async getActiveCaseAppointment(caseId: string): Promise<CaseAppointment | null> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
        doc('unassignedOn').notExists(),
      );
      return await this.getAdapter<CaseAppointmentDocument>().findOne(query);
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve active case appointment for case ${caseId}.`,
      });
    }
  }

  async createCaseAppointment(appointment: CaseAppointmentInput): Promise<CaseAppointment> {
    const document = createAuditRecord<Creatable<CaseAppointmentDocument>>(
      {
        ...appointment,
        documentType: 'CASE_APPOINTMENT',
      },
      SYSTEM_USER_REFERENCE,
    );

    try {
      const id = await this.getAdapter<Creatable<CaseAppointmentDocument>>().insertOne(document);
      return { ...document, id };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create case appointment for case ${appointment.caseId}.`,
      });
    }
  }

  async updateCaseAppointment(appointment: CaseAppointment): Promise<CaseAppointment> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('id').equals(appointment.id),
      );

      const updatedDocument: CaseAppointmentDocument = {
        ...appointment,
        documentType: 'CASE_APPOINTMENT',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: new Date().toISOString(),
      };

      await this.getAdapter<CaseAppointmentDocument>().replaceOne(query, updatedDocument);
      return updatedDocument;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update case appointment ${appointment.id}.`,
      });
    }
  }

  async findByCaseId(caseId: string): Promise<CaseAppointment[]> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
      );
      return await this.getAdapter<CaseAppointmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve case appointments for case ${caseId}.`,
      });
    }
  }

  async getChapter7DueDateMetricsAggregation(): Promise<TrusteeDueDateMetricsAggregation> {
    try {
      const pipeline = [
        // Stage 1: Filter to Chapter 7 appointments only
        {
          $match: {
            documentType: 'TRUSTEE_APPOINTMENT',
            chapter: '7',
          },
        },

        // Stage 2: Left join with key dates from trustees collection
        // Note: Using simple lookup (no 'let') for Cosmos DB compatibility
        {
          $lookup: {
            from: 'trustees',
            localField: 'id',
            foreignField: 'appointmentId',
            as: 'keyDates',
          },
        },

        // Stage 3: Filter keyDates to only TRUSTEE_UPCOMING_REPORT_DATES and extract first
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

        // Stage 4: Count how many field groups are populated (0-9)
        {
          $addFields: {
            fieldCount: {
              $sum: [
                // tprReviewPeriod requires BOTH start AND end
                {
                  $cond: [
                    {
                      $and: [
                        { $ifNull: ['$keyDoc.tprReviewPeriodStart', false] },
                        { $ifNull: ['$keyDoc.tprReviewPeriodEnd', false] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
                // pastFieldExam
                { $cond: [{ $ifNull: ['$keyDoc.pastFieldExam', false] }, 1, 0] },
                // pastAudit
                { $cond: [{ $ifNull: ['$keyDoc.pastAudit', false] }, 1, 0] },
                // tirReviewPeriod requires BOTH start AND end
                {
                  $cond: [
                    {
                      $and: [
                        { $ifNull: ['$keyDoc.tirReviewPeriodStart', false] },
                        { $ifNull: ['$keyDoc.tirReviewPeriodEnd', false] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
                // tprDue
                { $cond: [{ $ifNull: ['$keyDoc.tprDue', false] }, 1, 0] },
                // upcomingFieldExam
                { $cond: [{ $ifNull: ['$keyDoc.upcomingFieldExam', false] }, 1, 0] },
                // upcomingIndependentAuditRequired
                { $cond: [{ $ifNull: ['$keyDoc.upcomingIndependentAuditRequired', false] }, 1, 0] },
                // tirSubmission
                { $cond: [{ $ifNull: ['$keyDoc.tirSubmission', false] }, 1, 0] },
                // tirReview
                { $cond: [{ $ifNull: ['$keyDoc.tirReview', false] }, 1, 0] },
              ],
            },
          },
        },

        // Stage 5: Classify completeness: complete (9), partial (1-8), none (0)
        {
          $addFields: {
            completeness: {
              $switch: {
                branches: [
                  { case: { $eq: ['$fieldCount', 9] }, then: 'complete' },
                  { case: { $gt: ['$fieldCount', 0] }, then: 'partial' },
                ],
                default: 'none',
              },
            },
          },
        },

        // Stage 6: Group and count everything
        {
          $group: {
            _id: null,
            totalChapter7Appointments: { $sum: 1 },
            completeCount: {
              $sum: { $cond: [{ $eq: ['$completeness', 'complete'] }, 1, 0] },
            },
            partialCount: {
              $sum: { $cond: [{ $eq: ['$completeness', 'partial'] }, 1, 0] },
            },
            noneCount: {
              $sum: { $cond: [{ $eq: ['$completeness', 'none'] }, 1, 0] },
            },
            // Per-field counts
            tprReviewPeriodCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$keyDoc.tprReviewPeriodStart', false] },
                      { $ifNull: ['$keyDoc.tprReviewPeriodEnd', false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            pastFieldExamCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.pastFieldExam', false] }, 1, 0] },
            },
            pastIndependentAuditCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.pastAudit', false] }, 1, 0] },
            },
            tirReviewPeriodCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$keyDoc.tirReviewPeriodStart', false] },
                      { $ifNull: ['$keyDoc.tirReviewPeriodEnd', false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            tprDueDateCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.tprDue', false] }, 1, 0] },
            },
            upcomingFieldExamCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.upcomingFieldExam', false] }, 1, 0] },
            },
            upcomingIndependentAuditRequiredCount: {
              $sum: {
                $cond: [{ $ifNull: ['$keyDoc.upcomingIndependentAuditRequired', false] }, 1, 0],
              },
            },
            tirSubmissionCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.tirSubmission', false] }, 1, 0] },
            },
            tirReviewDueDateCount: {
              $sum: { $cond: [{ $ifNull: ['$keyDoc.tirReview', false] }, 1, 0] },
            },
          },
        },

        // Stage 7: Remove _id and keep only the metrics
        {
          $project: {
            _id: 0,
            totalChapter7Appointments: 1,
            completeCount: 1,
            partialCount: 1,
            noneCount: 1,
            tprReviewPeriodCount: 1,
            pastFieldExamCount: 1,
            pastIndependentAuditCount: 1,
            tirReviewPeriodCount: 1,
            tprDueDateCount: 1,
            upcomingFieldExamCount: 1,
            upcomingIndependentAuditRequiredCount: 1,
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

      // Handle empty result (no Chapter 7 appointments)
      if (results.length === 0) {
        return {
          totalChapter7Appointments: 0,
          completeCount: 0,
          partialCount: 0,
          noneCount: 0,
          tprReviewPeriodCount: 0,
          pastFieldExamCount: 0,
          pastIndependentAuditCount: 0,
          tirReviewPeriodCount: 0,
          tprDueDateCount: 0,
          upcomingFieldExamCount: 0,
          upcomingIndependentAuditRequiredCount: 0,
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
      const doc = using<CaseAppointmentDocument>();
      const query = doc('id').equals(id);
      await this.getAdapter<CaseAppointmentDocument>().deleteOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete case appointment ${id}.`,
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
