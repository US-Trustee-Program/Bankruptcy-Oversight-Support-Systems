import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import {
  CamsPaginationResponse,
  TrusteeCaseAppointmentsRepository,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import QueryPipeline from '../../../query/query-pipeline';
import {
  CaseAppointment,
  CaseAppointmentInput,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';
import { TrusteeCasesSearchPredicate } from '@common/api/search';
import { SyncedCase } from '@common/cams/cases';
import { buildCaseStatusCondition } from './utils/case-status-conditions';

const MODULE_NAME = 'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY';

// Partition key: caseId — for getByCaseId, getActiveByCaseId lookups
const CASE_COLLECTION = 'case-trustee-appointments';

// Partition key: trusteeId — for getCasesForTrustee aggregate
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

const CASES_COLLECTION = 'cases';

const { using, and } = QueryBuilder;
const {
  pipeline,
  match,
  join,
  sort,
  paginate,
  project,
  pick,
  omit,
  alias,
  descending,
  ascending,
  source,
} = QueryPipeline;

const apptDoc = source<CaseAppointmentDocument>(TRUSTEE_COLLECTION);
const caseDoc = source<SyncedCase>(CASES_COLLECTION, '_case');

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
      return await this.trusteePartition
        .adapter<TrusteeCaseListItem>()
        .paginate(
          pipeline(
            match(this.buildAppointmentMatch(trusteeId)),
            join(caseDoc.field('caseId'))
              .onto(apptDoc.field('caseId'))
              .as({ name: '_case' })
              .inner(),
            match(and(...this.buildCaseConditions(predicate))),
            sort(descending(caseDoc.field('dateFiled')), ascending(caseDoc.field('caseId'))),
            paginate(predicate.offset, predicate.limit),
            project(
              omit('_id'),
              alias('caseId', '_case.caseId'),
              alias('courtDivisionName', '_case.courtDivisionName'),
              alias('caseTitle', '_case.caseTitle'),
              alias('chapter', '_case.chapter'),
              alias('dateFiled', '_case.dateFiled'),
              pick('appointedDate'),
            ),
          ),
        );
    } catch (originalError) {
      // The adapter preserves the raw Mongo error message through the wrapping chain.
      // MongoDB surfaces the in-memory sort limit as a '$sort exceeded memory limit' message.
      const errorMessage =
        originalError instanceof Error ? originalError.message : String(originalError);
      if (errorMessage.includes('$sort exceeded memory limit')) {
        console.error(
          MODULE_NAME,
          `MongoDB aggregate pipeline $sort exceeded 100MB memory limit for trustee ${trusteeId}. Review appointment count and data volume for this trustee.`,
        );
      }

      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve cases for trustee ${trusteeId}.`,
      });
    }
  }

  private buildAppointmentMatch(trusteeId: string) {
    return and(
      apptDoc.field('documentType').equals('CASE_APPOINTMENT'),
      apptDoc.field('trusteeId').equals(trusteeId),
      apptDoc.field('unassignedOn').notExists(),
    );
  }

  private buildCaseConditions(predicate: TrusteeCasesSearchPredicate) {
    const conditions: ConditionOrConjunction<SyncedCase>[] = [
      caseDoc.field('documentType').equals('SYNCED_CASE'),
      caseDoc.field('movedToCaseId').notExists(),
    ];

    const statusCondition = buildCaseStatusCondition<SyncedCase>(predicate.caseStatus, '_case');
    if (statusCondition) conditions.push(statusCondition);

    if (predicate.chapters?.length) {
      conditions.push(caseDoc.field('chapter').contains(predicate.chapters));
    }
    if (predicate.filedDateFrom) {
      conditions.push(caseDoc.field('dateFiled').greaterThanOrEqual(predicate.filedDateFrom));
    }
    if (predicate.filedDateTo) {
      conditions.push(caseDoc.field('dateFiled').lessThanOrEqual(predicate.filedDateTo));
    }
    if (predicate.divisionCodes?.length) {
      conditions.push(caseDoc.field('courtDivisionCode').contains(predicate.divisionCodes));
    }

    return conditions;
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
