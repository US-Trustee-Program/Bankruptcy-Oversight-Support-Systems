import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import {
  CamsPaginationResponse,
  TrusteeCaseAppointmentsRepository,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import {
  CaseAppointment,
  CaseAppointmentInput,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';
import { TrusteeCasesSearchPredicate } from '@common/api/search';

const MODULE_NAME = 'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY';

// Partition key: caseId — for getByCaseId, getActiveByCaseId lookups
const CASE_COLLECTION = 'case-trustee-appointments';

// Partition key: trusteeId — for getCasesForTrustee aggregate
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

const { using, and } = QueryBuilder;

type CaseAppointmentDocument = CaseAppointment & {
  documentType: 'CASE_APPOINTMENT';
};

class CasePartitionRepository extends BaseMongoRepository {
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, CASE_COLLECTION);
  }
  adapter<T>() {
    return this.getAdapter<T>();
  }
}

class TrusteePartitionRepository extends BaseMongoRepository {
  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, TRUSTEE_COLLECTION);
  }
  adapter<T>() {
    return this.getAdapter<T>();
  }
  collection() {
    return this.client.database(this.databaseName).collection(this.collectionName);
  }
}

export class TrusteeCaseAppointmentsMongoRepository implements TrusteeCaseAppointmentsRepository {
  private static referenceCount: number = 0;
  private static instance: TrusteeCaseAppointmentsMongoRepository | null = null;

  private readonly casePartition: CasePartitionRepository;
  private readonly trusteePartition: TrusteePartitionRepository;

  constructor(context: ApplicationContext) {
    this.casePartition = new CasePartitionRepository(context);
    this.trusteePartition = new TrusteePartitionRepository(context);
  }

  public static getInstance(context: ApplicationContext): TrusteeCaseAppointmentsMongoRepository {
    if (!TrusteeCaseAppointmentsMongoRepository.instance) {
      TrusteeCaseAppointmentsMongoRepository.instance = new TrusteeCaseAppointmentsMongoRepository(
        context,
      );
    }
    TrusteeCaseAppointmentsMongoRepository.referenceCount++;
    return TrusteeCaseAppointmentsMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeCaseAppointmentsMongoRepository.referenceCount > 0) {
      TrusteeCaseAppointmentsMongoRepository.referenceCount--;
    }
    if (TrusteeCaseAppointmentsMongoRepository.referenceCount < 1) {
      TrusteeCaseAppointmentsMongoRepository.instance?.casePartition.closeClient().then();
      TrusteeCaseAppointmentsMongoRepository.instance?.trusteePartition.closeClient().then();
      TrusteeCaseAppointmentsMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeCaseAppointmentsMongoRepository.dropInstance();
  }

  async getByCaseId(caseId: string): Promise<CaseAppointment[]> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
      );
      return await this.casePartition.adapter<CaseAppointmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve case appointments for case ${caseId}.`,
      });
    }
  }

  async getActiveByCaseId(caseId: string): Promise<CaseAppointment | null> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
        doc('unassignedOn').notExists(),
      );
      return await this.casePartition.adapter<CaseAppointmentDocument>().findOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve active case appointment for case ${caseId}.`,
      });
    }
  }

  async getCasesForTrustee(
    trusteeId: string,
    predicate: TrusteeCasesSearchPredicate,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    try {
      const caseMatch: Record<string, unknown> = {
        '_case.documentType': 'SYNCED_CASE',
        '_case.movedToCaseId': { $exists: false },
      };

      if (predicate.caseStatus === 'OPEN') {
        caseMatch.$or = [
          { '_case.closedDate': { $exists: false } },
          {
            $and: [
              { '_case.closedDate': { $exists: true } },
              { '_case.reopenedDate': { $exists: true } },
              { $expr: { $gte: ['$_case.reopenedDate', '$_case.closedDate'] } },
            ],
          },
        ];
      } else if (predicate.caseStatus === 'CLOSED') {
        caseMatch.$and = [
          { '_case.closedDate': { $exists: true } },
          {
            $or: [
              { '_case.reopenedDate': { $exists: false } },
              { $expr: { $gte: ['$_case.closedDate', '$_case.reopenedDate'] } },
            ],
          },
        ];
      }

      if (predicate.chapters?.length) {
        caseMatch['_case.chapter'] = { $in: predicate.chapters };
      }

      if (predicate.filedDateFrom) {
        caseMatch['_case.dateFiled'] = {
          ...(caseMatch['_case.dateFiled'] as object | undefined),
          $gte: predicate.filedDateFrom,
        };
      }

      if (predicate.filedDateTo) {
        caseMatch['_case.dateFiled'] = {
          ...(caseMatch['_case.dateFiled'] as object | undefined),
          $lte: predicate.filedDateTo,
        };
      }

      if (predicate.divisionCodes?.length) {
        caseMatch['_case.courtDivisionCode'] = { $in: predicate.divisionCodes };
      }

      const pipeline = [
        {
          $match: {
            documentType: 'CASE_APPOINTMENT',
            trusteeId,
            unassignedOn: { $exists: false },
          },
        },
        { $lookup: { from: 'cases', localField: 'caseId', foreignField: 'caseId', as: '_case' } },
        { $unwind: '$_case' },
        { $match: caseMatch },
        { $sort: { '_case.dateFiled': -1, '_case.caseId': 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $skip: predicate.offset },
              { $limit: predicate.limit },
              {
                $project: {
                  _id: 0,
                  caseId: '$_case.caseId',
                  caseNumber: '$_case.caseNumber',
                  courtDivisionName: '$_case.courtDivisionName',
                  caseTitle: '$_case.caseTitle',
                  chapter: '$_case.chapter',
                  dateFiled: '$_case.dateFiled',
                  appointedDate: 1,
                },
              },
            ],
          },
        },
      ];

      const collection = this.trusteePartition.collection();
      const cursor = await collection.aggregate(pipeline);
      const results = [];
      for await (const result of cursor) {
        results.push(result);
      }

      return {
        data: results[0].data,
        metadata: { total: results[0].metadata[0]?.total ?? 0 },
      };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve cases for trustee ${trusteeId}.`,
      });
    }
  }

  async upsert(appointment: CaseAppointmentInput): Promise<CaseAppointment> {
    const document = createAuditRecord<Creatable<CaseAppointmentDocument>>(
      { ...appointment, documentType: 'CASE_APPOINTMENT' },
      SYSTEM_USER_REFERENCE,
    );

    // Natural key for idempotent upsert — safe to replay on retry
    const doc = using<CaseAppointmentDocument>();
    const naturalKeyQuery = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('caseId').equals(appointment.caseId),
      doc('trusteeId').equals(appointment.trusteeId),
      doc('assignedOn').equals(appointment.assignedOn),
      doc('source').equals(appointment.source ?? 'acms'),
    );

    let result: CaseAppointment;
    try {
      const replaceResult = await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(naturalKeyQuery, document as unknown as CaseAppointmentDocument, true);
      result = { ...document, id: replaceResult.id };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to upsert case appointment for case ${appointment.caseId}.`,
      });
    }

    try {
      const secondaryDocument = { ...document, id: result.id } as CaseAppointmentDocument;
      await this.trusteePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(naturalKeyQuery, secondaryDocument, true);
    } catch (secondaryError) {
      console.error(
        MODULE_NAME,
        `Dual-write to trustee partition failed for case ${appointment.caseId}:`,
        secondaryError,
      );
    }

    return result;
  }

  async updateCaseAppointment(appointment: CaseAppointment): Promise<CaseAppointment> {
    const updatedDocument: CaseAppointmentDocument = {
      ...appointment,
      documentType: 'CASE_APPOINTMENT',
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: new Date().toISOString(),
    };

    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('id').equals(appointment.id),
      );
      await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(query, updatedDocument);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update case appointment ${appointment.id}.`,
      });
    }

    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('id').equals(appointment.id),
      );
      await this.trusteePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(query, updatedDocument);
    } catch (secondaryError) {
      console.error(
        MODULE_NAME,
        `Dual-write update to trustee partition failed for appointment ${appointment.id}:`,
        secondaryError,
      );
    }

    return updatedDocument;
  }

  async delete(id: string): Promise<void> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = doc('id').equals(id);
      await this.casePartition.adapter<CaseAppointmentDocument>().deleteOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete case appointment ${id}.`,
      });
    }

    try {
      const doc = using<CaseAppointmentDocument>();
      const query = doc('id').equals(id);
      await this.trusteePartition.adapter<CaseAppointmentDocument>().deleteOne(query);
    } catch (secondaryError) {
      console.error(
        MODULE_NAME,
        `Dual-delete from trustee partition failed for appointment ${id}:`,
        secondaryError,
      );
    }
  }

  async deleteAllBySource(source: CaseAppointment['source']): Promise<{ deletedCount: number }> {
    // Paginated deletion to avoid Cosmos deleteMany timeouts on large collections.
    // Fetches BATCH_SIZE records sorted by partition key, extracts unique partition
    // key values, then issues one targeted single-partition deleteMany per unique
    // key. Each delete is fast (single partition, bounded document set).
    const BATCH_SIZE = 100;
    let totalDeleted = 0;

    // Delete from case partition (partitioned by caseId)
    try {
      type CaseDoc = CaseAppointmentDocument & { caseId: string };
      const docQ = using<CaseDoc>();
      const sortByCaseId = QueryBuilder.orderBy<CaseDoc>(['caseId', 'ASCENDING']);

      while (true) {
        const batchQuery = and(
          docQ('documentType').equals('CASE_APPOINTMENT'),
          docQ('source').equals(source),
        );
        const batch = await this.casePartition
          .adapter<CaseDoc>()
          .find(batchQuery, sortByCaseId, BATCH_SIZE);

        if (batch.length === 0) break;

        const uniqueCaseIds = [...new Set(batch.map((r) => r.caseId))];
        for (const caseId of uniqueCaseIds) {
          const deleteQuery = and(
            docQ('documentType').equals('CASE_APPOINTMENT'),
            docQ('caseId').equals(caseId),
            docQ('source').equals(source),
          );
          const count = await this.casePartition.adapter<CaseDoc>().deleteMany(deleteQuery);
          totalDeleted += count;
        }

        if (batch.length < BATCH_SIZE) break;
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete case appointments with source ${source}.`,
      });
    }

    // Delete from trustee partition (partitioned by trusteeId) — best effort
    try {
      type TrusteeDoc = CaseAppointmentDocument & { trusteeId: string };
      const docQ = using<TrusteeDoc>();
      const sortByTrusteeId = QueryBuilder.orderBy<TrusteeDoc>(['trusteeId', 'ASCENDING']);

      while (true) {
        const batchQuery = and(
          docQ('documentType').equals('CASE_APPOINTMENT'),
          docQ('source').equals(source),
        );
        const batch = await this.trusteePartition
          .adapter<TrusteeDoc>()
          .find(batchQuery, sortByTrusteeId, BATCH_SIZE);

        if (batch.length === 0) break;

        const uniqueTrusteeIds = [...new Set(batch.map((r) => r.trusteeId))];
        for (const trusteeId of uniqueTrusteeIds) {
          const deleteQuery = and(
            docQ('documentType').equals('CASE_APPOINTMENT'),
            docQ('trusteeId').equals(trusteeId),
            docQ('source').equals(source),
          );
          await this.trusteePartition.adapter<TrusteeDoc>().deleteMany(deleteQuery);
        }

        if (batch.length < BATCH_SIZE) break;
      }
    } catch (secondaryError) {
      console.error(
        MODULE_NAME,
        `Paginated delete from trustee partition failed for source ${source}:`,
        secondaryError,
      );
    }

    return { deletedCount: totalDeleted };
  }

  async findActiveMissingAppointedDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<CaseAppointment & { _id: string }>> {
    type CaseAppointmentQueryable = CaseAppointmentDocument & { _id: string };
    const doc = using<CaseAppointmentQueryable>();
    const conditions = [
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('unassignedOn').notExists(),
      doc('appointedDate').notExists(),
    ];
    if (lastId) conditions.push(doc('_id').greaterThan(lastId));
    const query = and(...conditions);
    return this.findByCursor<CaseAppointmentQueryable>(query, {
      limit,
      sortField: '_id',
      sortDirection: 'ASCENDING',
    });
  }

  async getAllCaseAppointments(
    lastId: string | null,
    limit: number,
  ): Promise<Array<CaseAppointment & { _id: string }>> {
    type CaseAppointmentQueryable = CaseAppointmentDocument & { _id: string };
    const doc = using<CaseAppointmentQueryable>();
    const conditions = [doc('documentType').equals('CASE_APPOINTMENT')];
    if (lastId) conditions.push(doc('_id').greaterThan(lastId));
    const query = and(...conditions);
    return this.findByCursor<CaseAppointmentQueryable>(query, {
      limit,
      sortField: '_id',
      sortDirection: 'ASCENDING',
    });
  }

  private async findByCursor<T>(
    query: ConditionOrConjunction<T>,
    options: { limit: number; sortField: keyof T; sortDirection: 'ASCENDING' | 'DESCENDING' },
  ): Promise<T[]> {
    try {
      const sortSpec = QueryBuilder.orderBy<T>([options.sortField, options.sortDirection]);
      return await this.casePartition.adapter<T>().find(query, sortSpec, options.limit);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to retrieve case appointments by cursor.',
      });
    }
  }
}
