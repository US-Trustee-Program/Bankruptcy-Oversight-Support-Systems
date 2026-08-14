/**
 * Use case for the ACMS trustee-professional-ids backfill -- a one-time migration that
 * cross-references CAMS trustees to ACMS professional IDs by demographic/appointment-history
 * matching, replacing the exact firstName+lastName+state matching that both the ATS-migration-time
 * path and the (now-deleted) recurring heal path used.
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

/** Phonetic-search shortlist size. A tuning knob with no principled derivation. Kept at 10 after
 * explicit investigation (CAMS-2-7a1): searchTrusteesByNameScored's Mongo aggregation has no limit() and
 * already ranks every phonetically-matching trustee before this app-level truncation, so raising
 * this number would cost nothing at the query layer -- Brian reviewed that finding and decided 10
 * remains adequate now that it is the sole candidate-recall mechanism (see CAMS-2-36t). */
const CANDIDATE_SHORTLIST_LIMIT = 10;

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
 * Builds the candidate shortlist for one ACMS professional record via `searchTrusteesByNameScored`
 * (phonetic search), built from `firstName [middleInitial] lastName`, capped at the top
 * `CANDIDATE_SHORTLIST_LIMIT` results.
 *
 * Deliberately does NOT fall back to an exact firstName+lastName+state match. An earlier version of
 * this function unioned in `findTrusteeByNameAndState` as a "free recall safety net" -- per explicit
 * user direction (CAMS-2-36t), that reintroduced the exact brittle-matching strategy this whole
 * dataflow exists to replace, so it was removed. Phonetic search is now the sole candidate-recall
 * mechanism; see CAMS-2-7a1 for the investigation into whether its cutoff is still adequate without
 * that fallback (conclusion: yes, at the current limit).
 */
export async function getCandidateTrustees(
  context: ApplicationContext,
  record: AcmsTrusteeProfessionalRecord,
): Promise<Trustee[]> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  const firstName = (record.firstName ?? '').trim();
  const lastName = (record.lastName ?? '').trim();
  const middleInitial = (record.middleInitial ?? '').trim();

  const fullName = [firstName, middleInitial, lastName].filter(Boolean).join(' ');

  const results = fullName ? await trusteesRepo.searchTrusteesByNameScored(fullName) : [];
  const shortlisted = results.slice(0, CANDIDATE_SHORTLIST_LIMIT);

  const candidatesById = new Map<string, Trustee>();
  for (const candidate of shortlisted) {
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
 * district/chapter Sets, including rows for closed/pre-2018 cases.
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
  // applied to any candidate, for every scored candidate (not just the eventual winner). A future
  // lower-environment run can sample the full score distribution (near-threshold, well above,
  // well below) from these logs to confirm ACMS_AUTO_MATCH_THRESHOLD (90) and
  // ACMS_FUZZY_MATCH_MIN_GAP (5) line up with actual correct/incorrect matches before the real
  // production run. Logged at `debug` (not `info`) since this fires once per scored candidate,
  // not once per record.
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

    // Batched, ONE call for the whole page's professional IDs -- not per record. Mirrors the same
    // batching discipline applied to the ACMS appointment fetch below and the CAMS appointment
    // fetch in scoreAndResolveRecord.
    const allProfessionalIds = records.map((record) => record.acmsProfessionalId);
    const existingMappings =
      await professionalIdsRepo.findByAcmsProfessionalIds(allProfessionalIds);
    const alreadyMappedIds = new Set(existingMappings.map((m) => m.acmsProfessionalId));

    let alreadyMapped = 0;
    const recordsToScore: AcmsTrusteeProfessionalRecord[] = [];

    for (const record of records) {
      if (alreadyMappedIds.has(record.acmsProfessionalId)) {
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
