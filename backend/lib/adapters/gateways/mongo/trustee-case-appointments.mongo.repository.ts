import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import {
  CamsPaginationResponse,
  CaseAppointmentMigrationInput,
  TrusteeCaseAppointmentsRepository,
} from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
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
import { isCaseClosed } from '@common/cams/cases';
import { toMongoQuery } from './utils/mongo-query-renderer';
import { SENTINEL_TRUSTEE_ID } from '../../../use-cases/dataflows/migrate-case-appointments-constants';

const MODULE_NAME = 'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY';

// Partition key: caseId — for getByCaseId, getActiveByCaseId lookups
const CASE_COLLECTION = 'case-trustee-appointments';

// Partition key: trusteeId — for getCasesForTrustee aggregate
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

const CASES_COLLECTION = 'cases';

// documentType discriminator for appointment docs in both partitions.
const CASE_APPOINTMENT_DOC_TYPE = 'CASE_APPOINTMENT' as const;

const { using, and } = QueryBuilder;
const { source } = QueryPipeline;

const apptDoc = source<CaseAppointmentDocument>(TRUSTEE_COLLECTION);

export type CaseAppointmentDocument = CaseAppointment & {
  documentType: 'CASE_APPOINTMENT';
  acmsProfessionalId?: string;
  reason?: string;
  movedToCaseId?: string;
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
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
        doc('caseId').equals(caseId),
        doc('unassignedOn').notExists(),
        doc('trusteeId').notEqual(SENTINEL_TRUSTEE_ID),
      );
      return await this.casePartition.adapter<CaseAppointmentDocument>().findOne(query);
    } catch (originalError) {
      if (isNotFoundError(originalError)) return null;
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
      const prePaginateMatch = toMongoQuery(this.buildPrePaginateMatch(trusteeId, predicate));

      const mongoAggregate = [
        { $match: prePaginateMatch },
        { $sort: { dateFiled: -1, caseId: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $skip: predicate.offset },
              { $limit: predicate.limit },
              {
                $lookup: {
                  from: CASES_COLLECTION,
                  localField: 'caseId',
                  foreignField: 'caseId',
                  as: '_case',
                },
              },
              { $unwind: { path: '$_case', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  _caseOrDefault: {
                    $ifNull: [
                      {
                        $cond: {
                          if: { $ifNull: ['$_case.movedToCaseId', false] },
                          then: null,
                          else: '$_case',
                        },
                      },
                      { caseTitle: 'Case not available', courtDivisionName: '' },
                    ],
                  },
                },
              },
              {
                $addFields: {
                  courtDivisionName: { $ifNull: ['$_caseOrDefault.courtDivisionName', ''] },
                  caseTitle: {
                    $ifNull: ['$_caseOrDefault.caseTitle', 'Case not available'],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  caseId: 1,
                  caseStatus: 1,
                  chapter: 1,
                  dateFiled: 1,
                  appointedDate: 1,
                  courtDivisionName: 1,
                  caseTitle: 1,
                },
              },
            ],
          },
        },
      ];

      const collection = this.trusteePartition.collection<CaseAppointmentDocument>();
      const cursor = await collection.aggregate(mongoAggregate);
      const result = await cursor.next();

      return {
        metadata: result?.metadata?.[0] ?? { total: 0 },
        data: result?.data ?? [],
      };
    } catch (originalError) {
      // MongoDB surfaces the in-memory sort limit as a '$sort exceeded memory limit' message.
      const errorMessage =
        originalError instanceof Error ? originalError.message : String(originalError);
      if (errorMessage.includes('$sort exceeded memory limit')) {
        this.context.logger.error(
          MODULE_NAME,
          `MongoDB aggregate pipeline $sort exceeded 100MB memory limit for trustee ${trusteeId}. Review appointment count and data volume for this trustee.`,
        );
      }

      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve cases for trustee ${trusteeId}.`,
      });
    }
  }

  async getDistinctDivisionsForTrustee(trusteeId: string): Promise<string[]> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const match = toMongoQuery(and(doc('trusteeId').equals(trusteeId)));

      const mongoAggregate = [
        { $match: match },
        { $group: { _id: null, divisions: { $addToSet: '$courtDivisionCode' } } },
      ];

      const collection = this.trusteePartition.collection<CaseAppointmentDocument>();
      const cursor = await collection.aggregate(mongoAggregate);
      const result = await cursor.next();

      return (result?.divisions ?? []).filter((code: string | undefined) => !!code);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve distinct divisions for trustee ${trusteeId}.`,
      });
    }
  }

  private buildPrePaginateMatch(trusteeId: string, predicate: TrusteeCasesSearchPredicate) {
    const conditions: ConditionOrConjunction<CaseAppointmentDocument>[] = [
      apptDoc.field('trusteeId').equals(trusteeId),
      apptDoc.field('unassignedOn').notExists(),
      apptDoc.field('dateFiled').exists(),
    ];

    if (predicate.caseStatus && predicate.caseStatus !== 'ALL') {
      conditions.push(apptDoc.field('caseStatus').equals(predicate.caseStatus));
    }
    if (predicate.chapters?.length) {
      conditions.push(apptDoc.field('chapter').contains(predicate.chapters));
    }
    if (predicate.filedDateFrom) {
      conditions.push(apptDoc.field('dateFiled').greaterThanOrEqual(predicate.filedDateFrom));
    }
    if (predicate.filedDateTo) {
      conditions.push(apptDoc.field('dateFiled').lessThanOrEqual(predicate.filedDateTo));
    }
    if (predicate.divisionCodes?.length) {
      conditions.push(apptDoc.field('courtDivisionCode').contains(predicate.divisionCodes));
    }

    return and(...conditions);
  }

  async upsert(
    appointment: CaseAppointmentInput | CaseAppointmentMigrationInput,
  ): Promise<CaseAppointment> {
    // Compute caseStatus whenever dateFiled is present (i.e. a migrated/enriched doc).
    const appointmentWithStatus: CaseAppointmentInput & { caseStatus?: 'OPEN' | 'CLOSED' } = {
      ...appointment,
    };
    if (appointment.dateFiled) {
      appointmentWithStatus.caseStatus = isCaseClosed(appointment) ? 'CLOSED' : 'OPEN';
    }

    const document = createAuditRecord<Creatable<CaseAppointmentDocument>>(
      { ...appointmentWithStatus, documentType: CASE_APPOINTMENT_DOC_TYPE },
      SYSTEM_USER_REFERENCE,
    );

    // Natural key for idempotent upsert — safe to replay on retry
    const doc = using<CaseAppointmentDocument>();
    const naturalKeyQuery = and(
      doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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
      documentType: CASE_APPOINTMENT_DOC_TYPE,
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: new Date().toISOString(),
    };

    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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
      doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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
    const conditions = [doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE)];
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
    const query = and(
      doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
      doc('caseId').equals(caseId),
    );

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
          doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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

  async getActiveByTrusteeIdFromTrusteePartition(
    trusteeId: string,
  ): Promise<Array<CaseAppointment>> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
      doc('trusteeId').equals(trusteeId),
      doc('unassignedOn').notExists(),
    );
    return this.trusteePartition.adapter<CaseAppointmentDocument>().find(query);
  }

  async replaceOneInTrusteePartition(
    query: { caseId: string; trusteeId: string; assignedOn: string },
    document: CaseAppointmentDocument,
  ): Promise<void> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const naturalKeyQuery = and(
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
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

  /**
   * resolveSentinelTrusteeId — rewrites a sentinel appointment (trusteeId ===
   * SENTINEL_TRUSTEE_ID) to a now-resolved trustee across both partitions.
   *
   * The trustee partition is keyed by trusteeId, so a resolved doc belongs in a
   * different partition than the sentinel — this is a move, not an in-place
   * replace. We delete the sentinel-partition row and upsert the resolved doc.
   * The case partition is keyed by caseId, so the resolved doc replaces the
   * sentinel row in place (its _id is preserved by the natural-key match).
   *
   * Trustee partition is written FIRST: if the process crashes before the case
   * partition replace, the sentinel remains visible to heal's scan (which reads
   * the case partition) and a re-run resolves it again idempotently. A missing
   * sentinel row in the trustee partition (already deleted by a prior partial
   * run) is tolerated.
   */
  async resolveSentinelTrusteeId(
    sentinelKey: { caseId: string; assignedOn: string },
    resolvedDocument: CaseAppointmentDocument,
  ): Promise<void> {
    const doc = using<CaseAppointmentDocument>();
    try {
      // 1. Trustee partition: remove the stale sentinel-partition row.
      const sentinelTrusteeQuery = and(
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
        doc('caseId').equals(sentinelKey.caseId),
        doc('trusteeId').equals(SENTINEL_TRUSTEE_ID),
        doc('assignedOn').equals(sentinelKey.assignedOn),
      );
      try {
        await this.trusteePartition
          .adapter<CaseAppointmentDocument>()
          .deleteOne(sentinelTrusteeQuery);
      } catch (deleteError) {
        // Idempotent: a prior partial run may have already removed it.
        if (!isNotFoundError(deleteError)) {
          throw deleteError;
        }
      }

      // 2. Trustee partition: upsert the resolved doc into its new partition.
      const resolvedNaturalKey = and(
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
        doc('caseId').equals(resolvedDocument.caseId),
        doc('trusteeId').equals(resolvedDocument.trusteeId),
        doc('assignedOn').equals(resolvedDocument.assignedOn),
      );
      await this.trusteePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(resolvedNaturalKey, resolvedDocument, true);

      // 3. Case partition: replace the sentinel row in place (caseId partition is
      // stable, so the existing _id is preserved by the natural-key match).
      const sentinelCaseQuery = and(
        doc('documentType').equals(CASE_APPOINTMENT_DOC_TYPE),
        doc('caseId').equals(sentinelKey.caseId),
        doc('trusteeId').equals(SENTINEL_TRUSTEE_ID),
        doc('assignedOn').equals(sentinelKey.assignedOn),
      );
      await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(sentinelCaseQuery, resolvedDocument, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to resolve sentinel appointment for case ${sentinelKey.caseId}.`,
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
