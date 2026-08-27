import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import { BadRequestError } from '../../../common-errors/bad-request';
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
import { isCaseClosed, VALID_CASE_CHAPTERS } from '@common/cams/cases';
import { toMongoQuery } from './utils/mongo-query-renderer';
import { classifyRateLimitError } from './utils/mongo-adapter';
import { SENTINEL_TRUSTEE_ID } from '../../../use-cases/dataflows/migrate-case-appointments-constants';

const MODULE_NAME = 'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY';

// Partition key: caseId — for getByCaseId, getActiveByCaseId lookups
const CASE_COLLECTION = 'case-trustee-appointments';

// Partition key: trusteeId — for getCasesForTrustee aggregate
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

const CASES_COLLECTION = 'cases';

const { using, and, orderBy } = QueryBuilder;
const { source } = QueryPipeline;

const apptDoc = source<CaseAppointmentDocument>(TRUSTEE_COLLECTION);

// Guards against ACMS/DXTR sub-codes (e.g. '7A', '7N') or other malformed
// values reaching CASE_APPOINTMENT documents. Chapter should already be
// normalized by the time it reaches this repository (see
// normalizeAcmsCaseChapter for the ACMS migration path).
function assertValidChapter(chapter: string | undefined): void {
  if (chapter === undefined) return;
  if (!VALID_CASE_CHAPTERS.includes(chapter as (typeof VALID_CASE_CHAPTERS)[number])) {
    throw new BadRequestError(MODULE_NAME, {
      message: `Invalid chapter value for case appointment: ${chapter}`,
      data: { chapter },
    });
  }
}

// The Mongo driver returns raw documents including Mongo's own _id, which is not part of the
// CaseAppointment type but is present at runtime and not stripped by the driver itself. That _id
// is only ever valid within the partition it was read from — a case may exist in two partitions
// (case-keyed and trustee-keyed), each with its own, independently-assigned _id — so a document
// read from one partition must never be spread into a write targeting either partition. Strip it
// here, at the read boundary, so it never leaks into any downstream caller's write payload; this
// is the fix for a leaked-_id bug that was previously patched only at one specific write call
// site (updateCaseAppointment) rather than at its actual source.
function stripMongoId(document: CaseAppointmentDocument): CaseAppointment {
  const { _id: _mongoId, ...rest } = document as CaseAppointmentDocument & { _id?: unknown };
  return rest;
}

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
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
      );
      const results = await this.casePartition.adapter<CaseAppointmentDocument>().find(query);
      return results.map(stripMongoId);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve case appointments for case ${caseId}.`,
      });
    }
  }

  /**
   * Returns the case's active REAL appointment, if any — excludes placeholder rows (surrogate
   * fingerprint markers and ACMS SENTINEL_TRUSTEE_ID rows), both of which may coexist with a
   * real active appointment and with each other on the same case. `isSurrogate` uses `$ne`
   * (via notEqual), which matches documents where the field is absent as well as `false` —
   * required so rows written before this field existed are still treated as real.
   *
   * Sorted by assignedOn DESCENDING so that if more than one active appointment ever exists for
   * a case (a known, currently-unprevented race between concurrent writers resolving the same
   * case to different trustees — see CAMS-809's dual-active-appointment discussion), this
   * deterministically returns the MOST RECENTLY ASSIGNED one as authoritative, rather than an
   * arbitrary or stale row that can vary between calls. assignedOn is the court's own
   * appointment date (event.appointedDate), not a Cosmos write timestamp, making it the correct
   * domain tiebreaker — and it's the same field the {caseId, assignedOn} index (see
   * cosmos-collections.bicep) is built to serve.
   *
   * A createdOn-DESCENDING secondary sort was tried here and reverted (CAMS-809): createdOn is
   * only a Cosmos write timestamp, with no relationship to which of two same-assignedOn rows is
   * the domain-correct appointment, so it was silently picking an arbitrary row and presenting it
   * as deterministic rather than fixing anything. It also required widening the composite index
   * to {caseId, assignedOn, createdOn}, since Cosmos DB's Mongo API rejects any ORDER BY not
   * fully covered by one composite index.
   *
   * Fetches 2 rows (not 1) so a same-assignedOn tie can actually be detected and logged as a
   * WARNING for operator follow-up, instead of being silently resolved by whichever row Cosmos
   * happens to return first when the sort keys are equal.
   */
  async getActiveByCaseId(caseId: string): Promise<CaseAppointment | null> {
    try {
      const doc = using<CaseAppointmentDocument>();
      const query = and(
        doc('documentType').equals('CASE_APPOINTMENT'),
        doc('caseId').equals(caseId),
        doc('unassignedOn').notExists(),
        doc('trusteeId').notEqual(SENTINEL_TRUSTEE_ID),
        doc('isSurrogate').notEqual(true),
      );
      const sort = orderBy<CaseAppointmentDocument>(['assignedOn', 'DESCENDING']);
      const results = await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .find(query, sort, 2);

      if (results.length > 1 && results[0].assignedOn === results[1].assignedOn) {
        this.context.logger.warn(
          MODULE_NAME,
          `AMBIGUOUS ACTIVE APPOINTMENT: case ${caseId} has multiple active, non-surrogate case ` +
            `appointments with the same assignedOn (${results[0].assignedOn}). Returning ` +
            `trusteeId ${results[0].trusteeId} (appointment id ${results[0].id}) arbitrarily — ` +
            `this choice is NOT guaranteed stable across calls. Investigate and resolve the ` +
            `duplicate active appointment for this case.`,
          {
            caseId,
            assignedOn: results[0].assignedOn,
            candidateIds: [results[0].id, results[1].id],
          },
        );
      }

      return results[0] ? stripMongoId(results[0]) : null;
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
    assertValidChapter(appointment.chapter);

    // Defensive strip: CaseAppointmentInput's declared type has no _id field, but TypeScript's
    // excess-property check only fires on object literals, not variables — a caller spreading a
    // raw read result into this parameter would carry _id through undetected otherwise. See
    // stripMongoId's comment for why this partition's _id must never leak into either partition's
    // replaceOne payload below.
    const { _id: _mongoId, ...appointmentWithoutMongoId } = appointment as (
      CaseAppointmentInput | CaseAppointmentMigrationInput
    ) & { _id?: unknown };

    // Compute caseStatus whenever dateFiled is present (i.e. a migrated/enriched doc).
    const appointmentWithStatus: CaseAppointmentInput & { caseStatus?: 'OPEN' | 'CLOSED' } = {
      ...appointmentWithoutMongoId,
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
    assertValidChapter(appointment.chapter);

    // getActiveByCaseId/getByCaseId strip Mongo's own _id at the read boundary (see
    // stripMongoId), so most callers no longer carry it here. findActiveMissingAppointedDate
    // is a genuine exception — it needs _id for cursor pagination, so it's honestly typed as
    // CaseAppointment & { _id: string } and does carry it through to callers like
    // backfill-case-appointment-dates.ts. Strip defensively here too, since this partition's
    // _id is only ever valid within THIS partition — the trustee partition's copy of the same
    // logical appointment has its own, independently-assigned _id — so it must never leak into
    // either partition's replaceOne payload below.
    const { _id: _caseAppointmentMongoId, ...appointmentWithoutMongoId } =
      appointment as CaseAppointment & {
        _id?: unknown;
      };

    // Compute caseStatus whenever dateFiled is present (enriched doc).
    const appointmentWithStatus = { ...appointmentWithoutMongoId };
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

  /**
   * Returns real, soft-closed appointments (unassignedOn is populated) — excludes placeholder rows
   * (surrogate fingerprint markers and ACMS SENTINEL_TRUSTEE_ID rows), the same exclusion
   * getActiveByCaseId applies. Cursor-paginated on _id for resumability across pages of a single
   * run, same shape as findActiveMissingAppointedDate/getAllCaseAppointments.
   */
  async findClosedAppointments(
    lastId: string | null,
    limit: number,
  ): Promise<Array<CaseAppointment & { _id: string }>> {
    type CaseAppointmentQueryable = CaseAppointmentDocument & { _id: string };
    const doc = using<CaseAppointmentQueryable>();
    const conditions = [
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('unassignedOn').exists(),
      doc('trusteeId').notEqual(SENTINEL_TRUSTEE_ID),
      doc('isSurrogate').notEqual(true),
    ];
    if (lastId) conditions.push(doc('_id').greaterThan(lastId));
    const query = and(...conditions);
    return this.findByCursor<CaseAppointmentQueryable>(query, {
      limit,
      sortField: '_id',
      sortDirection: 'ASCENDING',
    });
  }

  async updateCaseFields(caseId: string, fields: CaseDenormalizedFields): Promise<void> {
    assertValidChapter(fields.chapter);

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

  /**
   * Scoped to a real trusteeId (its original purpose — see migrate-case-appointments.ts's
   * caller). For the fingerprint-keyed surrogate lookup, use getSurrogatesByFingerprint
   * instead, which filters isSurrogate in the query itself rather than leaving callers to
   * post-filter by convention.
   */
  async getActiveByTrusteeIdFromTrusteePartition(
    trusteeId: string,
  ): Promise<Array<CaseAppointment>> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('trusteeId').equals(trusteeId),
      doc('unassignedOn').notExists(),
    );
    const results = await this.trusteePartition.adapter<CaseAppointmentDocument>().find(query);
    return results.map(stripMongoId);
  }

  /**
   * Returns every surrogate CaseAppointment sharing the given fingerprint — the cases affected
   * by a pending trustee mismatch. A surrogate's trusteeId is set to the fingerprint itself
   * (see writeSurrogateAppointment in sync-trustee-case-appointments.ts), so this queries the
   * same trustee partition as getActiveByTrusteeIdFromTrusteePartition but filters isSurrogate
   * in the query itself, making "these rows are membership markers, not a real trustee's
   * appointments" a property of the method rather than a convention callers must remember to
   * apply themselves.
   */
  async getSurrogatesByFingerprint(fingerprint: string): Promise<Array<CaseAppointment>> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('trusteeId').equals(fingerprint),
      doc('unassignedOn').notExists(),
      doc('isSurrogate').equals(true),
    );
    const results = await this.trusteePartition.adapter<CaseAppointmentDocument>().find(query);
    return results.map(stripMongoId);
  }

  /**
   * Batched sibling of getSurrogatesByFingerprint — one query for many fingerprints instead of
   * one query per fingerprint, so a caller building a list (e.g. the verification list endpoint)
   * doesn't run an N+1 query per row. Callers group the flat result by trusteeId themselves.
   */
  async getSurrogatesByFingerprints(fingerprints: string[]): Promise<Array<CaseAppointment>> {
    if (fingerprints.length === 0) return [];
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('trusteeId').contains(fingerprints),
      doc('unassignedOn').notExists(),
      doc('isSurrogate').equals(true),
    );
    const results = await this.trusteePartition.adapter<CaseAppointmentDocument>().find(query);
    return results.map(stripMongoId);
  }

  /**
   * True when a document matching this exact natural key (documentType + caseId + trusteeId +
   * assignedOn) exists in the trustee partition — used to detect dual-write divergence (see
   * applyResolvedTrustee in sync-trustee-case-appointments.ts): upsert()/updateCaseAppointment()
   * write casePartition then trusteePartition sequentially, so a transient failure on the second
   * write after the first succeeds can leave casePartition showing the trustee active while
   * trusteePartition never received the matching row. getActiveByCaseId only reads casePartition,
   * so without this check a retry would silently treat the case as already handled and never
   * repair trusteePartition. Scoped by the full natural key, not just caseId+trusteeId, since a
   * stale trusteePartition row from a PRIOR assignedOn is not evidence this write succeeded.
   */
  async existsInTrusteePartition(
    caseId: string,
    trusteeId: string,
    assignedOn: string,
  ): Promise<boolean> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('caseId').equals(caseId),
      doc('trusteeId').equals(trusteeId),
      doc('assignedOn').equals(assignedOn),
    );
    const results = await this.trusteePartition
      .adapter<CaseAppointmentDocument>()
      .find(query, undefined, 1);
    return results.length > 0;
  }

  /**
   * Finds an active (unassignedOn not set) trustee-partition row for this case belonging to a
   * DIFFERENT trustee than excludeTrusteeId — the mirror-direction divergence to
   * existsInTrusteePartition's same-trustee check. On a reassignment (case ${caseId} moving from
   * an old trustee to trusteeId), softCloseExistingAppointment writes casePartition then
   * trusteePartition sequentially and non-transactionally for the OLD trustee's row. A transient
   * failure on that trusteePartition write after casePartition already committed means a retry's
   * getActiveByCaseId (casePartition-only) sees nothing active for this case at all — the whole
   * reassignment-repair branch in applyResolvedTrustee is skipped, createNewAppointment runs
   * directly for the new trustee, and the old trustee's trusteePartition row is left permanently
   * active with no telemetry. migrate-case-appointments.ts's heal job cannot catch this either,
   * since it only scans casePartition-active documents forward, not stale trusteePartition rows
   * for a trustee who is no longer the active one. Scoped by caseId (not trusteeId, this
   * collection's shard key), so this fans out across trusteePartition's physical partitions —
   * acceptable here since it only runs on the narrow reassignment path, not a hot path.
   */
  async findStrandedActiveInTrusteePartition(
    caseId: string,
    excludeTrusteeId: string,
  ): Promise<CaseAppointment | null> {
    const doc = using<CaseAppointmentDocument>();
    const query = and(
      doc('documentType').equals('CASE_APPOINTMENT'),
      doc('caseId').equals(caseId),
      doc('trusteeId').notEqual(excludeTrusteeId),
      doc('unassignedOn').notExists(),
    );
    const results = await this.trusteePartition
      .adapter<CaseAppointmentDocument>()
      .find(query, undefined, 1);
    return results[0] ? stripMongoId(results[0]) : null;
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

  // Inverse of replaceOneInTrusteePartition — repairs a case-partition document
  // missing for a case-trusteeId-assignedOn triple that exists in the trustee
  // partition (see findAppointmentIdPairsByChapter's caseApptId: null result).
  async replaceOneInCasePartition(
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
      await this.casePartition
        .adapter<CaseAppointmentDocument>()
        .replaceOne(naturalKeyQuery, document, true);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to write to case partition for case ${query.caseId}.`,
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

  // matchChapter (and, pre-fix, the raw chapter values these methods read/write)
  // is intentionally a plain string, not CaseChapter — its entire purpose is
  // matching invalid legacy ACMS chapter codes (e.g. '7A', 'AC') that are not
  // valid CaseChapter values.
  //
  // caseApptId is null when the case partition has no matching document for
  // an active trustee-partition document (a partition-parity drift — see
  // heal()'s similar repair for the mechanism this mirrors). The caller
  // (applyChapterFix) is responsible for repairing that drift by creating the
  // missing case-partition document — this method only detects the gap, it
  // never writes.
  async findAppointmentIdPairsByChapter(
    matchChapter: string,
    limit: number,
  ): Promise<Array<{ trusteeApptId: string; caseApptId: string | null }>> {
    try {
      // Sourced exclusively from the trustee partition: it has an out-of-band
      // index on chapter alone (see
      // ops/cloud-deployment/lib/cosmos/mongo/index-trustee-case-appointments.js's
      // chapter_1 index) supporting this $match. documentType is deliberately
      // NOT part of the $match or that index: every document ever written to
      // either partition by this repository carries documentType:
      // 'CASE_APPOINTMENT' (verified — grep this file), so it has no
      // discriminating value here and including it would only require a
      // wider (and, without a compound index covering it, unindexed) match.
      // An earlier version of this comment claimed a chapter-supporting
      // index already existed — it did not; querying an unindexed chapter
      // field on this trusteeId-sharded collection forced Cosmos to fan an
      // unindexed scan out across every physical partition on every call,
      // which is what caused sustained RU throttling in production even at
      // a 100-document $limit (RU is charged per document examined, not
      // returned, so a small $limit does not bound the cost of an unindexed
      // $match). The case partition has no chapter index either and times
      // out under a direct filter scan at production data volumes, so its
      // matching documents are found here via a server-side $lookup on the
      // natural key instead — never queried by chapter directly.
      //
      // The $lookup uses ONLY the simple localField/foreignField/as form on
      // caseId (case-trustee-appointments's shard key and an indexed field —
      // the same indexed-join pattern already proven by getCasesForTrustee's
      // $lookup into the cases collection). Cosmos DB's MongoDB API rejects
      // a $lookup with a `pipeline` option at all (even combined with
      // localField/foreignField) with "pipeline not supported" (code 115,
      // CommandNotSupported) — confirmed against this Cosmos account in
      // production. All further narrowing (documentType, trusteeId,
      // assignedOn) therefore happens client-side in the subsequent
      // $addFields/$filter stage instead of inside the $lookup.
      //
      // A $expr-based match on all three natural-key fields was considered
      // and rejected: $expr comparisons are not guaranteed to use an index
      // the way plain field-equality matching does, and an unindexed
      // per-document lookup at 10,000 documents/batch would risk
      // reproducing the exact RU/timeout problem this whole query exists to
      // avoid. caseId alone narrows to at most a handful of documents (all
      // appointments for that case), which the $filter stage then narrows
      // further by documentType + trusteeId + assignedOn — cheap once
      // caseId has already done the expensive part of the filtering.
      const mongoAggregate = [
        {
          $match: {
            chapter: matchChapter,
          },
        },
        { $limit: limit },
        {
          $lookup: {
            from: CASE_COLLECTION,
            localField: 'caseId',
            foreignField: 'caseId',
            as: '_caseAppts',
          },
        },
        {
          $addFields: {
            // $arrayElemAt over $filter (not the array-expression form of
            // $first) matches the pattern already used and proven against
            // this Cosmos account elsewhere in this codebase — see
            // trustee-appointments.mongo.repository.ts and
            // mongo-aggregate-renderer.ts for the same construct.
            _caseAppt: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$_caseAppts',
                    as: 'candidate',
                    cond: {
                      $and: [
                        { $eq: ['$$candidate.documentType', 'CASE_APPOINTMENT'] },
                        { $eq: ['$$candidate.trusteeId', '$trusteeId'] },
                        { $eq: ['$$candidate.assignedOn', '$assignedOn'] },
                      ],
                    },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            trusteeApptId: '$_id',
            caseApptId: { $ifNull: ['$_caseAppt._id', null] },
          },
        },
      ];

      const collection = this.trusteePartition.collection<CaseAppointmentDocument>();
      const cursor = await collection.aggregate(mongoAggregate);
      const results = (await cursor.toArray()) as unknown as Array<{
        trusteeApptId: string;
        caseApptId: string | null;
      }>;
      return results.map((result) => ({
        trusteeApptId: String(result.trusteeApptId),
        caseApptId: result.caseApptId === null ? null : String(result.caseApptId),
      }));
    } catch (originalError) {
      // This aggregate runs directly against the collection (bypassing
      // BaseMongoRepository's adapter), so it must classify RU-throttling
      // itself via the same helper handleError uses, rather than
      // reimplementing the classification here.
      const rateLimitError = classifyRateLimitError(originalError, MODULE_NAME);
      if (rateLimitError) {
        throw rateLimitError;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find case appointment id pairs by chapter ${matchChapter}.`,
      });
    }
  }

  // Fixes both partitions for each id pair. Each partition write is independently
  // try/caught (matching updateCaseFields's convention) so a failure names which
  // partition it came from. If the trustee-partition write succeeds but a later
  // step then fails, the two collections are left divergent for this page until
  // the writer's caller retries — retrying is safe: applyChapterFix only ever
  // matches documents still carrying matchChapter, so a completed partition's
  // documents simply no longer match and are silently skipped on retry.
  //
  // A pair with caseApptId: null (see findAppointmentIdPairsByChapter) means the
  // case partition has no document for this trustee-partition appointment — a
  // partition-parity drift. For 'rename', this is repaired by creating the
  // missing case-partition document with the chapter already corrected (one
  // combined write, not create-then-update), copying the trustee-partition
  // document's own fields as the source of truth, mirroring heal()'s existing
  // partition-repair mechanism (replaceOneInTrusteePartition) in the opposite
  // direction. For 'delete', a null caseApptId means there is nothing to delete
  // on the case side — it's skipped, not repaired, since deletion's goal (no
  // case-partition document with this chapter) is already satisfied.
  async applyChapterFix(
    idPairs: Array<{ trusteeApptId: string; caseApptId: string | null }>,
    operation: 'rename' | 'delete',
    matchChapter: string,
    setChapter?: string,
  ): Promise<{ modifiedCount: number }> {
    // See findAppointmentIdPairsByChapter — matchChapter (and, pre-fix, chapter)
    // must accept legacy invalid codes, so chapter is widened to a plain string.
    type CaseAppointmentQueryable = Omit<CaseAppointmentDocument, 'chapter'> & {
      _id: string;
      chapter?: string;
    };

    const trusteeIds = idPairs.map((pair) => pair.trusteeApptId);
    const existingCaseIds = idPairs
      .map((pair) => pair.caseApptId)
      .filter((caseApptId): caseApptId is string => caseApptId !== null);
    const missingCasePairs = idPairs.filter((pair) => pair.caseApptId === null);

    if (operation === 'rename') {
      assertValidChapter(setChapter);
    }

    let trusteeModifiedCount: number;
    try {
      const trusteeDoc = using<CaseAppointmentQueryable>();
      const trusteeQuery = and(
        trusteeDoc('_id').contains(trusteeIds),
        trusteeDoc('documentType').equals('CASE_APPOINTMENT'),
        trusteeDoc('chapter').equals(matchChapter),
      );
      if (operation === 'rename') {
        const result = await this.trusteePartition
          .adapter<CaseAppointmentQueryable>()
          .updateMany(trusteeQuery, { $set: { chapter: setChapter } });
        trusteeModifiedCount = result.modifiedCount;
      } else {
        trusteeModifiedCount = await this.trusteePartition
          .adapter<CaseAppointmentQueryable>()
          .deleteMany(trusteeQuery);
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to apply chapter fix (${operation}) for chapter ${matchChapter} in trustee partition.`,
      });
    }

    if (existingCaseIds.length > 0) {
      try {
        const caseDoc = using<CaseAppointmentQueryable>();
        const caseQuery = and(
          caseDoc('_id').contains(existingCaseIds),
          caseDoc('documentType').equals('CASE_APPOINTMENT'),
          caseDoc('chapter').equals(matchChapter),
        );
        if (operation === 'rename') {
          await this.casePartition
            .adapter<CaseAppointmentQueryable>()
            .updateMany(caseQuery, { $set: { chapter: setChapter } });
        } else {
          await this.casePartition.adapter<CaseAppointmentQueryable>().deleteMany(caseQuery);
        }
      } catch (originalError) {
        throw getCamsErrorWithStack(originalError, MODULE_NAME, {
          message: `Failed to apply chapter fix (${operation}) for chapter ${matchChapter} in case partition.`,
        });
      }
    }

    if (operation === 'rename' && missingCasePairs.length > 0) {
      await this.repairMissingCasePartitionDocuments(
        missingCasePairs.map((pair) => pair.trusteeApptId),
        setChapter as string,
      );
    }

    return { modifiedCount: trusteeModifiedCount };
  }

  // Repairs partition-parity drift found by findAppointmentIdPairsByChapter:
  // reads each trustee-partition document that had no case-partition
  // counterpart, and creates the missing case-partition document from it —
  // with the chapter already set to its corrected value, since the whole
  // point of this repair is bringing the case partition in line with a
  // rename this same call is already applying to the trustee partition.
  private async repairMissingCasePartitionDocuments(
    trusteeApptIds: string[],
    correctedChapter: string,
  ): Promise<void> {
    let trusteeDocs: Array<CaseAppointmentDocument & { _id: string }>;
    try {
      const doc = using<CaseAppointmentDocument & { _id: string }>();
      const query = doc('_id').contains(trusteeApptIds);
      trusteeDocs = await this.trusteePartition
        .adapter<CaseAppointmentDocument & { _id: string }>()
        .find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to read trustee partition documents needed to repair partition drift.',
      });
    }

    for (const trusteeDoc of trusteeDocs) {
      const { _id: _unused, ...documentFields } = trusteeDoc;
      const repairedDocument = {
        ...documentFields,
        chapter: correctedChapter,
        documentType: 'CASE_APPOINTMENT' as const,
      } as CaseAppointmentDocument;

      try {
        await this.replaceOneInCasePartition(
          {
            caseId: trusteeDoc.caseId,
            trusteeId: trusteeDoc.trusteeId,
            assignedOn: trusteeDoc.assignedOn,
          },
          repairedDocument,
        );
      } catch (originalError) {
        // replaceOneInCasePartition already wraps the underlying error with a
        // descriptive CamsError — log for operational visibility and let it
        // propagate rather than rewrap (getCamsErrorWithStack preserves the
        // original message for an already-CamsError input, so rewrapping here
        // would not have changed the thrown message anyway).
        this.context.logger.error(
          MODULE_NAME,
          `Failed to repair missing case partition document for case ${trusteeDoc.caseId}:`,
          originalError,
        );
        throw originalError;
      }
    }
  }
}
