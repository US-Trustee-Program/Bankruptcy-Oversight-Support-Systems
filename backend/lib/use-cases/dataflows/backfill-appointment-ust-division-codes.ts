import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { UstpOfficeDetails } from '@common/cams/offices';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { AppointmentUstDivisionCodeBackfillState } from '../gateways.types';
import {
  BackfillWriteOptions,
  BASE_DELAY_MS,
  computeNextBackoffMs,
  MaybeData,
  SAFE_THRESHOLD_MS,
  sleep,
} from './queue-types';

const MODULE_NAME = 'BACKFILL-APPOINTMENT-UST-DIVISION-CODES-USE-CASE';
const STATE_DOCUMENT_TYPE = 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE';

const { and, using } = QueryBuilder;

type CourtDivisionMap = {
  acmsToUst: Map<string, string[]>;
  acmsCodes: Set<string>;
  allUstCodes: string[];
};

export type CourtDivisionMaps = Map<string, CourtDivisionMap>;

// Scoped to Eastern District of TN, matching the SYNCED_CASE backfill
// (backfill-ust-division-code.ts). Remapping appointments in another divergent court would stop
// them matching that court's cases that haven't been re-synced with a ustDivisionCode, since
// nothing backfills those cases.
const EASTERN_DISTRICT_TN_COURT_ID = '0649';

/**
 * Builds, per court, the mapping from ACMS division codes (CS_DIV_ACMS) to bare codes (CS_DIV).
 * Only in-scope courts where at least one division's bare code differs from its ACMS code are
 * included.
 */
function buildCourtDivisionMaps(offices: UstpOfficeDetails[]): CourtDivisionMaps {
  const pairsByCourt = new Map<string, Map<string, string>>();
  for (const office of offices) {
    for (const group of office.groups) {
      for (const division of group.divisions) {
        const courtId = division.court.courtId;
        if (courtId !== EASTERN_DISTRICT_TN_COURT_ID) continue;
        const ustCode = division.ustDivisionCode ?? division.divisionCode;
        if (!pairsByCourt.has(courtId)) pairsByCourt.set(courtId, new Map());
        pairsByCourt.get(courtId)!.set(ustCode, division.divisionCode);
      }
    }
  }

  const maps: CourtDivisionMaps = new Map();
  for (const [courtId, ustToAcms] of pairsByCourt) {
    const diverges = [...ustToAcms].some(([ust, acms]) => ust !== acms);
    if (!diverges) continue;

    const acmsToUst = new Map<string, string[]>();
    for (const [ust, acms] of ustToAcms) {
      acmsToUst.set(acms, [...(acmsToUst.get(acms) ?? []), ust].sort());
    }
    maps.set(courtId, {
      acmsToUst,
      acmsCodes: new Set(acmsToUst.keys()),
      allUstCodes: [...ustToAcms.keys()].sort(),
    });
  }
  return maps;
}

type RemapCategory = 'unchanged' | 'wholeDistrict' | 'remapped' | 'ambiguous';

type RemapResult = {
  category: RemapCategory;
  divisionCodes: string[];
};

/**
 * Translates an appointment's ACMS division codes to bare codes:
 * - An appointment covering every ACMS code in its court (every ATS-migrated appointment) gets
 *   every bare code in the court.
 * - An ACMS code shared by several divisions (e.g. 491 → Chattanooga 491, Winchester 494) can't
 *   be resolved, so it expands to all of them. That keeps every match the appointment has today;
 *   the AUST narrows it by hand from the logged list.
 * - Codes that aren't ACMS codes in the court (already bare) are kept as-is.
 */
function remapDivisionCodes(courtMap: CourtDivisionMap, codes: string[]): RemapResult {
  const unique = new Set(codes);
  const coversDistrict = [...courtMap.acmsCodes].every((code) => unique.has(code));

  let ambiguous = false;
  let remapped: string[];
  if (coversDistrict) {
    remapped = courtMap.allUstCodes;
  } else {
    const out = new Set<string>();
    for (const code of unique) {
      const candidates = courtMap.acmsToUst.get(code) ?? [code];
      if (candidates.length > 1) ambiguous = true;
      candidates.forEach((c) => out.add(c));
    }
    remapped = [...out].sort();
  }

  const unchanged =
    remapped.length === codes.length && remapped.every((code, i) => code === codes[i]);
  if (unchanged) return { category: 'unchanged', divisionCodes: codes };
  if (coversDistrict) return { category: 'wholeDistrict', divisionCodes: remapped };
  return { category: ambiguous ? 'ambiguous' : 'remapped', divisionCodes: remapped };
}

type AppointmentDocument = TrusteeAppointment & { _id: string; documentType?: string };

type AppointmentsPage = {
  appointments: AppointmentDocument[];
  lastId: string | null;
  hasMore: boolean;
};

async function getPageOfAppointments(
  context: ApplicationContext,
  courtIds: string[],
  cutoff: string,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<AppointmentsPage>> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);
    const doc = using<AppointmentDocument>();
    const conditions = [
      doc('documentType').equals('TRUSTEE_APPOINTMENT'),
      doc('courtId').contains(courtIds),
      doc('updatedOn').lessThan(cutoff),
    ];
    if (lastId) conditions.push(doc('_id').greaterThan(lastId));

    const results = await repo.findByCursor<AppointmentDocument>(and(...conditions), {
      limit: limit + 1,
      sortField: '_id',
      sortDirection: 'ASCENDING',
    });

    const hasMore = results.length > limit;
    const appointments = results.slice(0, limit);
    const newLastId = appointments.length > 0 ? appointments[appointments.length - 1]._id : null;
    return { data: { appointments, lastId: newLastId, hasMore } };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of trustee appointments (lastId: ${lastId}, limit: ${limit}).`,
      ),
    };
  }
}

function toAppointmentInput(
  appointment: AppointmentDocument,
  divisionCodes: string[],
): TrusteeAppointmentInput {
  const {
    _id: _oid,
    documentType: _documentType,
    id: _id,
    trusteeId: _trusteeId,
    createdOn: _createdOn,
    createdBy: _createdBy,
    updatedOn: _updatedOn,
    updatedBy: _updatedBy,
    ...input
  } = appointment;
  return { ...input, divisionCodes };
}

type WriteOutcome = 'written' | 'failed' | 'escaped';

async function writeDivisionCodes(
  context: ApplicationContext,
  appointment: AppointmentDocument,
  divisionCodes: string[],
  options: BackfillWriteOptions,
): Promise<WriteOutcome> {
  const repo = factory.getTrusteeAppointmentsRepository(context);
  let attempt = 0;
  while (true) {
    try {
      await repo.updateAppointment(
        appointment.trusteeId,
        appointment.id,
        toAppointmentInput(appointment, divisionCodes),
        SYSTEM_USER_REFERENCE,
      );
      return 'written';
    } catch (originalError) {
      if (isTooManyRequestsError(originalError)) {
        const nextBackoffMs = computeNextBackoffMs(attempt, options.baseDelayMs);
        if (Date.now() - options.startedAt + nextBackoffMs >= options.safeThresholdMs) {
          return 'escaped';
        }
        await sleep(nextBackoffMs);
        attempt++;
        continue;
      }
      const message =
        originalError instanceof Error ? originalError.message : String(originalError);
      context.logger.error(
        MODULE_NAME,
        `Failed to update appointment ${appointment.id} (trustee ${appointment.trusteeId}): ${message}`,
      );
      return 'failed';
    }
  }
}

function sourceDivisionCodes(appointment: TrusteeAppointment): string[] {
  if (appointment.divisionCodes && appointment.divisionCodes.length > 0) {
    return appointment.divisionCodes;
  }
  return appointment.divisionCode ? [appointment.divisionCode] : [];
}

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | { status: 'ok'; nextCursor: { lastId: string | null } | null };

/**
 * Remaps one page of appointments and records progress in the state document. A dry run logs
 * what it would change and counts it, but writes nothing.
 */
async function processBackfillPage(
  context: ApplicationContext,
  cursorLastId: string | null,
  pageSize: number,
  options: Partial<BackfillWriteOptions> = {},
): Promise<ProcessBackfillPageResult> {
  const writeOptions: BackfillWriteOptions = {
    startedAt: options.startedAt ?? Date.now(),
    safeThresholdMs: options.safeThresholdMs ?? SAFE_THRESHOLD_MS,
    baseDelayMs: options.baseDelayMs ?? BASE_DELAY_MS,
  };

  const stateResult = await readBackfillState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };
  const state = stateResult.data;
  if (!state) {
    return {
      status: 'error',
      error: getCamsError(new Error('No backfill run has been started.'), MODULE_NAME),
    };
  }

  let courtMaps: CourtDivisionMaps;
  try {
    courtMaps = buildCourtDivisionMaps(
      await factory.getOfficesGateway(context).getOffices(context),
    );
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(originalError, MODULE_NAME, 'Failed to fetch DXTR office data.'),
    };
  }

  const pageResult = await getPageOfAppointments(
    context,
    [...courtMaps.keys()],
    state.cutoff,
    cursorLastId,
    pageSize,
  );
  if (pageResult.error || !pageResult.data) {
    return {
      status: 'error',
      error:
        (pageResult.error as CamsError) ??
        getCamsError(new Error('Unexpected missing data in page result'), MODULE_NAME),
    };
  }

  const { appointments, lastId, hasMore } = pageResult.data;
  const terminalStatus = (failedCount: number) =>
    failedCount > 0 ? 'COMPLETED_WITH_FAILURES' : 'COMPLETED';

  if (appointments.length === 0) {
    const updateResult = await updateBackfillState(context, {
      ...state,
      lastId: cursorLastId,
      status: terminalStatus(state.failedCount),
    });
    if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };
    return { status: 'empty' };
  }

  let processed = 0;
  let updated = 0;
  let ambiguous = 0;
  let failed = 0;
  let escaped = false;

  for (const appointment of appointments) {
    const courtMap = courtMaps.get(appointment.courtId)!;
    const codes = sourceDivisionCodes(appointment);
    const { category, divisionCodes } = remapDivisionCodes(courtMap, codes);

    if (category !== 'unchanged') {
      const action = state.dryRun ? 'Would remap' : 'Remapping';
      const message =
        `${action} appointment ${appointment.id} (trustee ${appointment.trusteeId}, court ` +
        `${appointment.courtId}, chapter ${appointment.chapter}) from [${codes.join(', ')}] to ` +
        `[${divisionCodes.join(', ')}] (${category}).`;
      if (category === 'ambiguous') {
        context.logger.warn(MODULE_NAME, `${message} Needs AUST review.`);
      } else {
        context.logger.info(MODULE_NAME, message);
      }

      if (!state.dryRun) {
        const outcome = await writeDivisionCodes(context, appointment, divisionCodes, writeOptions);
        if (outcome === 'escaped') {
          escaped = true;
          break;
        }
        if (outcome === 'failed') {
          failed++;
          processed++;
          continue;
        }
      }
      updated++;
      if (category === 'ambiguous') ambiguous++;
    }
    processed++;
  }

  // On escape, resume after the last appointment actually processed.
  const pageLastId = escaped
    ? processed > 0
      ? appointments[processed - 1]._id
      : cursorLastId
    : lastId;
  const pageHasMore = escaped || hasMore;
  const failedCount = state.failedCount + failed;

  const updateResult = await updateBackfillState(context, {
    ...state,
    lastId: pageLastId,
    processedCount: state.processedCount + processed,
    updatedCount: state.updatedCount + updated,
    ambiguousCount: state.ambiguousCount + ambiguous,
    failedCount,
    status: pageHasMore ? 'IN_PROGRESS' : terminalStatus(failedCount),
  });
  if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };

  return { status: 'ok', nextCursor: pageHasMore ? { lastId: pageLastId } : null };
}

export type BackfillStartOptions = {
  cutoff?: string;
  dryRun?: boolean;
};

type StartBackfillResult =
  | { status: 'error'; error: CamsError }
  | { status: 'invalid'; reason: string }
  | { status: 'completed'; state: AppointmentUstDivisionCodeBackfillState }
  | { status: 'started'; lastId: string | null };

/**
 * Resumes an in-progress run, or starts a fresh one. A completed real run is never repeated
 * without resetting the state document; a completed dry run is replaced by the next start.
 * Runs default to dry runs — a real run needs `dryRun: false`.
 */
async function startBackfill(
  context: ApplicationContext,
  options: BackfillStartOptions,
): Promise<StartBackfillResult> {
  const stateResult = await readBackfillState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };
  const existing = stateResult.data;

  if (existing?.status === 'IN_PROGRESS') {
    return { status: 'started', lastId: existing.lastId };
  }
  if (existing && !existing.dryRun) {
    return { status: 'completed', state: existing };
  }

  const cutoffMs = options.cutoff ? Date.parse(options.cutoff) : NaN;
  if (Number.isNaN(cutoffMs)) {
    return {
      status: 'invalid',
      reason: `A start message needs an ISO 8601 cutoff (got ${options.cutoff ?? 'none'}).`,
    };
  }

  const now = new Date().toISOString();
  const updateResult = await updateBackfillState(context, {
    id: existing?.id,
    documentType: STATE_DOCUMENT_TYPE,
    lastId: null,
    cutoff: new Date(cutoffMs).toISOString(),
    dryRun: options.dryRun ?? true,
    processedCount: 0,
    updatedCount: 0,
    ambiguousCount: 0,
    failedCount: 0,
    startedAt: now,
    lastUpdatedAt: now,
    status: 'IN_PROGRESS',
  });
  if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };
  return { status: 'started', lastId: null };
}

async function readBackfillState(
  context: ApplicationContext,
): Promise<MaybeData<AppointmentUstDivisionCodeBackfillState | null>> {
  try {
    const repo = factory.getAppointmentUstDivisionCodeBackfillStateRepo(context);
    return { data: await repo.read(STATE_DOCUMENT_TYPE) };
  } catch (originalError) {
    if (isNotFoundError(originalError)) return { data: null };
    return { error: getCamsError(originalError, MODULE_NAME, 'Failed to read backfill state.') };
  }
}

async function updateBackfillState(
  context: ApplicationContext,
  state: AppointmentUstDivisionCodeBackfillState,
): Promise<MaybeData<AppointmentUstDivisionCodeBackfillState>> {
  try {
    const repo = factory.getAppointmentUstDivisionCodeBackfillStateRepo(context);
    const result = await repo.upsert({ ...state, lastUpdatedAt: new Date().toISOString() });
    return { data: result };
  } catch (originalError) {
    return { error: getCamsError(originalError, MODULE_NAME, 'Failed to update backfill state.') };
  }
}

const BackfillAppointmentUstDivisionCodesUseCase = {
  buildCourtDivisionMaps,
  remapDivisionCodes,
  getPageOfAppointments,
  processBackfillPage,
  startBackfill,
  readBackfillState,
};

export default BackfillAppointmentUstDivisionCodesUseCase;
