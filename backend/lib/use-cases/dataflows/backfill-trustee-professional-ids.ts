/**
 * Use case for the ACMS trustee-professional-ids backfill -- a one-time migration that
 * cross-references CAMS trustees to ACMS professional IDs by demographic/appointment-history
 * matching, replacing the exact firstName+lastName+state matching that both the ATS-migration-time
 * path and the (now-deleted) recurring heal path used. See
 * TRUSTEE-ACMS-BACKFILL_CONVERGED_DESIGN.md for the full design.
 *
 * This is a different data flow from migrate-trustees.ts (ACMS-driven identity matching, not
 * ATS-driven import) and is kept as its own file deliberately, per Screaming Architecture.
 *
 * All the accept-rule/scoring logic lives in acms-trustee-match.helpers.ts's
 * `resolveAcmsProfessionalMatch`, which is deliberately I/O-free -- this file is responsible for
 * ALL of the I/O: building the candidate shortlist, batch-fetching appointment history for both the
 * ACMS professional (per page, not per record) and each CAMS candidate, and building both sides'
 * district/chapter Sets, before handing fully-resolved data to that pure function.
 */
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { MaybeData } from './queue-types';
import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CamsUserReference } from '@common/cams/users';
import {
  AcmsProfessionalAppointmentRecord,
  AcmsTrusteeProfessionalRecord,
} from '../gateways.types';
import { normalizeChapter } from './trustee-match.helpers';
import {
  CandidateScoreBreakdown,
  resolveAcmsProfessionalMatch,
} from './acms-trustee-match.helpers';

const MODULE_NAME = 'BACKFILL-TRUSTEE-PROFESSIONAL-IDS-USE-CASE';

/**
 * System user reference for audit trail on mappings created by this backfill.
 * Mirrors migrate-trustees.ts's own SYSTEM_USER convention rather than inventing a new one.
 */
const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ACMS Professional ID Backfill',
};

/** Tier 2 phonetic-search shortlist size. A tuning knob with no principled derivation -- see
 * the converged design doc's "Candidate-selection strategy" section. */
const TIER_2_CANDIDATE_LIMIT = 10;

export type BackfillPageResult = {
  matched: number;
  unmatched: number;
  alreadyMapped: number;
};

/**
 * Reader half of the backfill: fetch the full set of ACMS trustee professional records (CMMPR,
 * PROF_TYPE='TR'), now via the widened `getAllTrusteeProfessionalRecords` gateway method (name,
 * middle initial, address, phone). Lifted in spirit from migrate-trustees.ts's
 * `readAllTrusteeProfessionalRecords` (same try/catch-wrapped-in-MaybeData shape), retargeted at
 * the widened gateway method. The original in migrate-trustees.ts is untouched -- its removal is a
 * separate, later cleanup task.
 */
export async function readAllAcmsProfessionalRecords(
  context: ApplicationContext,
): Promise<MaybeData<AcmsTrusteeProfessionalRecord[]>> {
  try {
    const acmsGateway = factory.getAcmsGateway(context);
    const acmsRecords = await acmsGateway.getAllTrusteeProfessionalRecords(context);
    context.logger.info(
      MODULE_NAME,
      `Backfill reader: fetched ${acmsRecords.length} ACMS professional records`,
    );
    return { data: acmsRecords };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read ACMS professional records'),
    };
  }
}

/**
 * Builds the Tier 1 ∪ Tier 2 candidate shortlist for one ACMS professional record, de-duplicated
 * by `trusteeId`.
 *
 * Tier 1 (`findTrusteeByNameAndState`, exact name+state match) is purely additive -- a free recall
 * safety net for cases where Tier 2's phonetic ranking might under-rank a correct match past the
 * shortlist cutoff. It is never auto-accepted and never gates the candidate set; it is only ever
 * unioned into it.
 *
 * Tier 2 (`searchTrusteesByNameScored`, phonetic search) takes the top `TIER_2_CANDIDATE_LIMIT`
 * results, built from `firstName [middleInitial] lastName`.
 */
export async function getCandidateTrustees(
  context: ApplicationContext,
  record: AcmsTrusteeProfessionalRecord,
): Promise<Trustee[]> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  const firstName = (record.firstName ?? '').trim();
  const lastName = (record.lastName ?? '').trim();
  const state = (record.state ?? '').trim();
  const middleInitial = (record.middleInitial ?? '').trim();

  const fullName = [firstName, middleInitial, lastName].filter(Boolean).join(' ');

  const [tier1Result, tier2Results] = await Promise.all([
    firstName && lastName && state
      ? trusteesRepo.findTrusteeByNameAndState(firstName, lastName, state)
      : Promise.resolve(null),
    fullName ? trusteesRepo.searchTrusteesByNameScored(fullName) : Promise.resolve([]),
  ]);

  const tier2Top = tier2Results.slice(0, TIER_2_CANDIDATE_LIMIT);

  const candidatesById = new Map<string, Trustee>();
  if (tier1Result) {
    candidatesById.set(tier1Result.trusteeId, tier1Result);
  }
  for (const candidate of tier2Top) {
    if (!candidatesById.has(candidate.trusteeId)) {
      candidatesById.set(candidate.trusteeId, candidate);
    }
  }

  return Array.from(candidatesById.values());
}

/**
 * Maps a raw `CASE_DIV` value through the division-to-court map, tolerating either a raw or
 * already-zero-padded key (the map is keyed on the gateway's own zero-padded convention).
 */
function resolveCourtId(
  courtDivisionCode: string,
  divisionToCourtMap: Map<string, string>,
): string | undefined {
  return (
    divisionToCourtMap.get(courtDivisionCode) ??
    divisionToCourtMap.get(courtDivisionCode.padStart(3, '0'))
  );
}

/**
 * Builds the ACMS-side district (courtId) and chapter Sets for one professional, from its full,
 * unfiltered set of CMMAP+CMMDB appointment rows.
 *
 * CRITICAL -- NO ACTIVE-ONLY FILTERING: `AcmsProfessionalAppointmentRecord` carries no status field
 * at all (the batched gateway query deliberately drops the open-case filter), so there is nothing
 * to filter here by construction -- every row returned for this professional counts toward its
 * district/chapter Sets, including rows for closed/pre-2018 cases. See the converged design doc's
 * "No active-only filtering" decision.
 */
function buildAcmsAppointmentSets(
  rows: AcmsProfessionalAppointmentRecord[],
  divisionToCourtMap: Map<string, string>,
): { districts: Set<string>; chapters: Set<string> } {
  const districts = new Set<string>();
  const chapters = new Set<string>();

  for (const row of rows) {
    const courtId = resolveCourtId(row.courtDivisionCode, divisionToCourtMap);
    if (courtId) {
      districts.add(courtId);
    }
    if (row.chapter) {
      chapters.add(normalizeChapter(row.chapter));
    }
  }

  return { districts, chapters };
}

/**
 * Groups a batch of appointments by trusteeId, seeding an empty array for every requested
 * candidate so callers get a consistent Map (not just the trusteeIds that happen to have
 * appointments).
 */
function groupAppointmentsByTrusteeId(
  candidateTrustees: Trustee[],
  appointments: TrusteeAppointment[],
): Map<string, TrusteeAppointment[]> {
  const byTrusteeId = new Map<string, TrusteeAppointment[]>();
  for (const candidate of candidateTrustees) {
    byTrusteeId.set(candidate.trusteeId, []);
  }
  for (const appointment of appointments) {
    const appointmentsForTrustee = byTrusteeId.get(appointment.trusteeId) ?? [];
    appointmentsForTrustee.push(appointment);
    byTrusteeId.set(appointment.trusteeId, appointmentsForTrustee);
  }
  return byTrusteeId;
}

/**
 * Scores and resolves a single ACMS professional record against its candidate shortlist, then
 * creates the mapping on a match. Returns which bucket ('matched' | 'unmatched') the record landed
 * in, for the caller's running counts.
 *
 * No active-only filtering: the CAMS-side district/chapter Sets (built inside
 * `resolveAcmsProfessionalMatch`) are built from `candidateAppointments`'s FULL, unfiltered
 * appointment history -- see `getAppointmentsByTrusteeIds`'s call site below, which applies no
 * status filter.
 */
async function scoreAndResolveRecord(
  context: ApplicationContext,
  record: AcmsTrusteeProfessionalRecord,
  acmsRows: AcmsProfessionalAppointmentRecord[],
  divisionToCourtMap: Map<string, string>,
): Promise<'matched' | 'unmatched'> {
  const trusteeAppointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);

  const acmsAppointmentSets = buildAcmsAppointmentSets(acmsRows, divisionToCourtMap);
  const candidateTrustees = await getCandidateTrustees(context, record);

  // Batched via getAppointmentsByTrusteeIds for this record's whole candidate set (small, ~1-11
  // candidates) rather than one call per candidate. Skipped entirely when there are no candidates
  // -- nothing to fetch, and resolveAcmsProfessionalMatch short-circuits on an empty candidate list
  // without needing appointment data anyway.
  const candidateAppointments =
    candidateTrustees.length === 0
      ? []
      : await trusteeAppointmentsRepo.getAppointmentsByTrusteeIds(
          candidateTrustees.map((candidate) => candidate.trusteeId),
        );
  const candidateAppointmentsByTrusteeId = groupAppointmentsByTrusteeId(
    candidateTrustees,
    candidateAppointments,
  );

  // Diagnostic-level, per-candidate score breakdown -- logged BEFORE the accept-rule decision is
  // applied to any candidate, per every scored candidate (not just the eventual winner). This is
  // the instrumentation the converged design doc's "Auto-match threshold" validation plan depends
  // on: a future lower-environment run needs to sample the full score distribution
  // (near-threshold, well above, well below) to confirm ACMS_AUTO_MATCH_THRESHOLD (90) and
  // ACMS_FUZZY_MATCH_MIN_GAP (5) line up with actual correct/incorrect matches before the real
  // production run. Logged at `debug` (not `info`) since this fires once per scored candidate,
  // not once per record -- see
  // BACKFILL-TRUSTEE-PROFESSIONAL-IDS-VALIDATION-PLAN.md for how to run that validation pass.
  const logCandidateScore = (breakdown: CandidateScoreBreakdown) => {
    context.logger.debug(
      MODULE_NAME,
      `Backfill candidate score: acmsProfessionalId=${breakdown.acmsProfessionalId} ` +
        `trusteeId=${breakdown.trusteeId} totalScore=${breakdown.totalScore} ` +
        `nameScore=${breakdown.nameScore} addressScore=${breakdown.addressScore} ` +
        `phoneScore=${breakdown.phoneScore} districtScore=${breakdown.districtScore} ` +
        `chapterScore=${breakdown.chapterScore}`,
    );
  };

  const outcome = resolveAcmsProfessionalMatch(
    record,
    acmsAppointmentSets,
    candidateTrustees,
    candidateAppointmentsByTrusteeId,
    logCandidateScore,
  );

  if (outcome.kind === 'matched') {
    await professionalIdsRepo.createProfessionalId(
      outcome.trusteeId,
      record.acmsProfessionalId,
      SYSTEM_USER,
    );
    context.logger.info(
      MODULE_NAME,
      `Backfill: matched ACMS professional ${record.acmsProfessionalId} to trustee ${outcome.trusteeId} (score ${outcome.score})`,
    );
    return 'matched';
  }

  context.logger.info(
    MODULE_NAME,
    `Backfill: ACMS professional ${record.acmsProfessionalId} left unmatched (permanent)`,
  );
  return 'unmatched';
}

/**
 * Processes one page of ACMS professional records:
 * 1. Skip records that already have a mapping (`findByAcmsProfessionalId`) -- counted as
 *    `alreadyMapped`, never scored.
 * 2. Batch-fetch CMMAP+CMMDB appointment rows for the WHOLE PAGE's not-yet-mapped professional IDs
 *    in ONE call to `getCmmapAppointmentsForProfessionalIds` -- not once per record. This avoids
 *    ~N round trips to a legacy upstream system for an N-record page; it is a hard, non-negotiable
 *    requirement from the converged design.
 * 3. Per remaining record: build its ACMS-side district/chapter Sets from its slice of the batched
 *    rows, get its candidate shortlist, batch-fetch each candidate's FULL (no status filtering)
 *    `TrusteeAppointment[]`, build the CAMS-side Sets, and call `resolveAcmsProfessionalMatch` with
 *    all pre-resolved data.
 * 4. On a match, create the mapping. On no match, log and count -- no JSONL/manual-review artifact,
 *    per the design's "permanently unmatched, no take-backs" requirement.
 */
export async function processAcmsProfessionalRecordsPage(
  context: ApplicationContext,
  records: AcmsTrusteeProfessionalRecord[],
  divisionToCourtMap: Map<string, string>,
): Promise<MaybeData<BackfillPageResult>> {
  try {
    const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
    const acmsGateway = factory.getAcmsGateway(context);

    let alreadyMapped = 0;
    const recordsToScore: AcmsTrusteeProfessionalRecord[] = [];

    for (const record of records) {
      const existing = await professionalIdsRepo.findByAcmsProfessionalId(
        record.acmsProfessionalId,
      );
      if (existing.length > 0) {
        alreadyMapped++;
      } else {
        recordsToScore.push(record);
      }
    }

    let matched = 0;
    let unmatched = 0;

    if (recordsToScore.length > 0) {
      // Hard requirement: ONE batched call for the whole page's professional IDs, not per record.
      const professionalIds = recordsToScore.map((record) => record.acmsProfessionalId);
      const appointmentRows = await acmsGateway.getCmmapAppointmentsForProfessionalIds(
        context,
        professionalIds,
      );

      const rowsByProfessionalId = new Map<string, AcmsProfessionalAppointmentRecord[]>();
      for (const row of appointmentRows) {
        const rows = rowsByProfessionalId.get(row.acmsProfessionalId) ?? [];
        rows.push(row);
        rowsByProfessionalId.set(row.acmsProfessionalId, rows);
      }

      for (const record of recordsToScore) {
        const acmsRows = rowsByProfessionalId.get(record.acmsProfessionalId) ?? [];
        const resultKind = await scoreAndResolveRecord(
          context,
          record,
          acmsRows,
          divisionToCourtMap,
        );

        if (resultKind === 'matched') {
          matched++;
        } else {
          unmatched++;
        }
      }
    }

    context.logger.info(
      MODULE_NAME,
      `Backfill page complete: matched=${matched} unmatched=${unmatched} alreadyMapped=${alreadyMapped}`,
    );

    return { data: { matched, unmatched, alreadyMapped } };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to process backfill page'),
    };
  }
}

/**
 * BackfillTrusteeProfessionalIdsUseCase class.
 *
 * Wraps the stateless exported functions as instance methods, with the ApplicationContext bound at
 * construction time, per this repo's DI convention (context injected via constructor, everything
 * else obtained via `factory.get*(context)` calls inside methods -- repositories/gateways are never
 * injected directly). All underlying named exports remain intact so tests can continue to import
 * and call them directly.
 */
class BackfillTrusteeProfessionalIdsUseCase {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  readAllAcmsProfessionalRecords(): ReturnType<typeof readAllAcmsProfessionalRecords> {
    return readAllAcmsProfessionalRecords(this.context);
  }

  getPage(
    records: Parameters<typeof processAcmsProfessionalRecordsPage>[1],
    divisionToCourtMap: Parameters<typeof processAcmsProfessionalRecordsPage>[2],
  ): ReturnType<typeof processAcmsProfessionalRecordsPage> {
    return processAcmsProfessionalRecordsPage(this.context, records, divisionToCourtMap);
  }
}

export default BackfillTrusteeProfessionalIdsUseCase;
