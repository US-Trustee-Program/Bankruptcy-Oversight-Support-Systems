import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import {
  CamsPaginationResponse,
  TrusteeCaseAppointmentsRepository,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import QueryBuilder, { ConditionOrConjunction } from '../../../query/query-builder';
import QueryPipeline from '../../../query/query-pipeline';
import {
  CaseAppointment,
  CaseAppointmentInput,
  CaseDenormalizedFields,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';
import { TrusteeCasesSearchPredicate } from '@common/api/search';
import { SyncedCase, isCaseClosed } from '@common/cams/cases';
import { buildCaseStatusCondition } from './utils/case-status-conditions';

const MODULE_NAME = 'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY';

// Sentinel trustee ID for unmapped appointments
const SENTINEL_TRUSTEE_ID = '00000000-0000-0000-0000-000000000000';

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

export type CaseAppointmentDocument = CaseAppointment & {
  documentType: 'CASE_APPOINTMENT';
};

type TrusteeCaseListItemWithStatusDates = Omit<TrusteeCaseListItem, 'caseStatus'> & {
  closedDate?: string;
  reopenedDate?: string;
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
  collection<T>() {
    return this.client.database(this.databaseName).collection<T>(TRUSTEE_COLLECTION);
  }
}

export class TrusteeCaseAppointmentsMongoRepository implements TrusteeCaseAppointmentsRepository {
  private static referenceCount: number = 0;
  private static instance: TrusteeCaseAppointmentsMongoRepository | null = null;

  private readonly context: ApplicationContext;
  private readonly casePartition: CasePartitionRepository;
  private readonly trusteePartition: TrusteePartitionRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
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
        doc('trusteeId').notEqual(SENTINEL_TRUSTEE_ID),
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
      const result = await this.trusteePartition
        .adapter<TrusteeCaseListItemWithStatusDates>()
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
              alias('closedDate', '_case.closedDate'),
              alias('reopenedDate', '_case.reopenedDate'),
              pick('appointedDate'),
            ),
          ),
        );

      return {
        metadata: result.metadata,
        data: result.data.map(({ closedDate, reopenedDate, ...item }) => ({
          ...item,
          caseStatus: isCaseClosed({ closedDate, reopenedDate }) ? 'CLOSED' : ('OPEN' as const),
        })),
      };
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
    // Compute caseStatus whenever dateFiled is present (i.e. a migrated/enriched doc).
    // A case with no closedDate is always OPEN regardless of the appointment's unassignedOn.
    const appointmentWithStatus: CaseAppointmentInput & { caseStatus?: 'OPEN' | 'CLOSED' } = {
      ...appointment,
    };
    if (appointment.dateFiled) {
      appointmentWithStatus.caseStatus = isCaseClosed(appointment) ? 'CLOSED' : 'OPEN';
    }

    const document = createAuditRecord<Creatable<CaseAppointmentDocument>>(
      { ...appointmentWithStatus, documentType: 'CASE_APPOINTMENT' },
      SYSTEM_USER_REFERENCE,
    );

    // Natural key for idempotent upsert — safe to replay on retry
    const doc = using<CaseAppointmentDocument>();
    const naturalKeyQuery = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('caseId').equals(appointment.caseId),
      doc('trusteeId').equals(appointment.trusteeId),
      doc('assignedOn').equals(appointment.assignedOn),
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
      this.context.logger.error(
        MODULE_NAME,
        `Dual-write to trustee partition failed for case ${appointment.caseId}:`,
        secondaryError,
      );
      throw getCamsErrorWithStack(secondaryError, MODULE_NAME, {
        message: `Dual-write to trustee partition failed for case ${appointment.caseId}.`,
      });
    }

    return result;
  }

  async updateCaseAppointment(appointment: CaseAppointment): Promise<CaseAppointment> {
    // Compute caseStatus whenever dateFiled is present (enriched doc).
    const appointmentWithStatus = { ...appointment };
    if (appointment.dateFiled) {
      appointmentWithStatus.caseStatus = isCaseClosed(appointment) ? 'CLOSED' : 'OPEN';
    }

    const updatedDocument: CaseAppointmentDocument = {
      ...appointmentWithStatus,
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
      this.context.logger.error(
        MODULE_NAME,
        `Dual-write update to trustee partition failed for appointment ${appointment.id}:`,
        secondaryError,
      );
      throw getCamsErrorWithStack(secondaryError, MODULE_NAME, {
        message: `Dual-write update to trustee partition failed for appointment ${appointment.id}.`,
      });
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
      this.context.logger.error(
        MODULE_NAME,
        `Dual-delete from trustee partition failed for appointment ${id}:`,
        secondaryError,
      );
      throw getCamsErrorWithStack(secondaryError, MODULE_NAME, {
        message: `Dual-delete from trustee partition failed for appointment ${id}.`,
      });
    }
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

  async updateCaseFields(caseId: string, fields: CaseDenormalizedFields): Promise<void> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(doc('documentType').equals('CASE_APPOINTMENT'), doc('caseId').equals(caseId));

    // Update fields: do NOT include source (being removed in follow-up)
    const updateFields = {
      dateFiled: fields.dateFiled,
      caseStatus: fields.caseStatus,
      chapter: fields.chapter,
      courtDivisionCode: fields.courtDivisionCode,
    };

    // Update case partition with updateMany to hit ALL appointments for this case
    try {
      await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .updateMany(query, updateFields as unknown as Partial<CaseAppointmentDocument>);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update case fields for case ${caseId} in case partition.`,
      });
    }

    // Fetch all appointments from case partition to extract unique trusteeIds
    let caseAppointments: CaseAppointmentDocument[];
    try {
      caseAppointments = await this.casePartition.adapter<CaseAppointmentDocument>().find(query);
    } catch (readError) {
      throw getCamsErrorWithStack(readError, MODULE_NAME, {
        message: `Failed to read case appointments for case ${caseId} to determine trustee partitions.`,
      });
    }

    // Deduplicate trusteeIds
    const uniqueTrusteeIds = [...new Set(caseAppointments.map((appt) => appt.trusteeId))];

    // For each unique trusteeId, issue a targeted updateMany to trustee partition
    for (const trusteeId of uniqueTrusteeIds) {
      try {
        const trusteeQuery = and(
          doc('documentType').equals('CASE_APPOINTMENT'),
          doc('caseId').equals(caseId),
          doc('trusteeId').equals(trusteeId),
        );
        await this.trusteePartition
          .adapter<CaseAppointmentDocument>()
          .updateMany(trusteeQuery, updateFields as unknown as Partial<CaseAppointmentDocument>);
      } catch (secondaryError) {
        this.context.logger.error(
          MODULE_NAME,
          `Dual-write updateCaseFields to trustee partition failed for case ${caseId} trustee ${trusteeId}:`,
          secondaryError,
        );
        throw getCamsErrorWithStack(secondaryError, MODULE_NAME, {
          message: `Failed to update case fields for case ${caseId} in trustee partition.`,
        });
      }
    }
  }

  private getTrusteeCollection(): CollectionHumble<CaseAppointmentDocument> {
    return this.trusteePartition.collection<CaseAppointmentDocument>();
  }

  async checkIndexExists(indexName: string): Promise<boolean> {
    const collection = this.getTrusteeCollection();
    const indexList = await collection.listIndexes().toArray();
    return indexList.some((idx) => idx.name === indexName);
  }

  async getActiveByTrusteeIdFromTrusteePartition(
    trusteeId: string,
  ): Promise<Array<CaseAppointment>> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('trusteeId').equals(trusteeId),
      doc('unassignedOn').notExists(),
    );
    return this.trusteePartition.adapter<CaseAppointmentDocument>().find(query);
  }

  async createCompoundIndex(): Promise<void> {
    const collection = this.getTrusteeCollection();
    await collection.createIndex({ trusteeId: 1, unassignedOn: 1, dateFiled: 1, caseStatus: 1 });
  }

  async dropIndex(indexName: string): Promise<void> {
    const collection = this.getTrusteeCollection();
    await collection.dropIndex(indexName);
  }

  async replaceOneInTrusteePartition(
    query: { caseId: string; trusteeId: string; assignedOn: string },
    document: CaseAppointmentDocument,
  ): Promise<void> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const naturalKeyQuery = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(query.caseId),
        doc('trusteeId').equals(query.trusteeId),
        doc('assignedOn').equals(query.assignedOn),
      );
      await this.trusteePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(naturalKeyQuery, document, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write to trustee partition for case ${query.caseId}.`,
      });
    }
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
