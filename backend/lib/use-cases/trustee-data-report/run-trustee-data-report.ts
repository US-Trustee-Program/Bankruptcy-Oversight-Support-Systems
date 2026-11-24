import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import {
  TrusteeDataDifference,
  TrusteeDataReportRun,
  TrusteeDataReportSummary,
} from '@common/cams/trustee-data-report';
import { AtsTrusteeRecord } from '../../adapters/types/ats.types';
import {
  compareTrusteeProfile,
  findCamsOnly,
  findTodOnly,
  summarize,
} from './compare-trustee-profiles';
import TrusteeDataReportLock from './trustee-data-report-lock';
import { compareTrusteeAppointments } from './compare-trustee-appointments';
import { buildDistrictToDivisionsMap } from '../dataflows/migrate-trustees';
import { Trustee } from '@common/cams/trustees';

export const RUN_TRUSTEE_DATA_REPORT_MODULE_NAME = 'RUN-TRUSTEE-DATA-REPORT';
const MODULE_NAME = RUN_TRUSTEE_DATA_REPORT_MODULE_NAME;

/** TOD trustees read per page message. */
const PAGE_SIZE = 100;

// This use case only reads trustees, appointments and TOD. Its only writes are to the
// trustee-data-report collection and the run lock.

function addCounts<K extends string>(a: Record<K, number>, b: Record<K, number>) {
  const sum = { ...a };
  for (const [key, count] of Object.entries(b) as [K, number][]) {
    sum[key] += count;
  }
  return sum;
}

function addSummaries(
  a: TrusteeDataReportSummary,
  b: TrusteeDataReportSummary,
): TrusteeDataReportSummary {
  return {
    trusteesCompared: a.trusteesCompared + b.trusteesCompared,
    todOnly: a.todOnly + b.todOnly,
    todOnlyStatusMissing: a.todOnlyStatusMissing + b.todOnlyStatusMissing,
    camsOnly: a.camsOnly + b.camsOnly,
    fieldDifferences: a.fieldDifferences + b.fieldDifferences,
    fieldDifferencesByField: addCounts(a.fieldDifferencesByField, b.fieldDifferencesByField),
    appointmentsTodOnly: a.appointmentsTodOnly + b.appointmentsTodOnly,
    appointmentsCamsOnly: a.appointmentsCamsOnly + b.appointmentsCamsOnly,
    appointmentFieldDifferences: a.appointmentFieldDifferences + b.appointmentFieldDifferences,
    appointmentFieldDifferencesByField: addCounts(
      a.appointmentFieldDifferencesByField,
      b.appointmentFieldDifferencesByField,
    ),
    appointmentsDivisionsNarrowed:
      a.appointmentsDivisionsNarrowed + b.appointmentsDivisionsNarrowed,
    todAppointmentsNotTranslated: a.todAppointmentsNotTranslated + b.todAppointmentsNotTranslated,
  };
}

async function requireRun(
  context: ApplicationContext,
  runId: string,
): Promise<TrusteeDataReportRun> {
  const run = await factory.getTrusteeDataReportRepository(context).readRun(runId);
  if (!run) {
    throw new CamsError(MODULE_NAME, { message: `Trustee data report run ${runId} not found.` });
  }
  return run;
}

async function requireLock(context: ApplicationContext, runId: string): Promise<void> {
  if (!(await TrusteeDataReportLock.isCurrentRun(context, runId))) {
    throw new CamsError(MODULE_NAME, {
      message: `Trustee data report run ${runId} no longer holds the run lock.`,
    });
  }
}

/**
 * Records one page's differences and counts, replacing anything an earlier attempt at the same
 * page wrote, so a retried page is never counted twice. The run's summary is added up from these
 * page counts when the run finishes. The lock is checked again just before writing, so a run that
 * was replaced while it read this page writes nothing.
 */
async function recordPage(
  context: ApplicationContext,
  runId: string,
  pageKey: string,
  differences: TrusteeDataDifference[],
  trusteesCompared: number,
  todAppointmentsNotTranslated: number,
): Promise<void> {
  await requireLock(context, runId);
  await factory
    .getTrusteeDataReportRepository(context)
    .replacePageResults(
      runId,
      pageKey,
      differences,
      summarize(differences, trusteesCompared, todAppointmentsNotTranslated),
    );
}

const FINALIZE_PAGE_KEY = 'finalize';
const pageKeyFor = (cursor: number | null) => `page-${cursor ?? 'start'}`;

/**
 * Moves a queued run to running. Returns 'skipped' for a missing run or one already past
 * queued (a redelivered start message), and fails a run that does not hold the lock.
 */
async function startRun(
  context: ApplicationContext,
  runId: string,
): Promise<'started' | 'skipped'> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const run = await reportRepo.readRun(runId);
  if (!run || run.status !== 'queued') {
    context.logger.warn(
      MODULE_NAME,
      `Skipping start for run ${runId}: status ${run?.status ?? 'missing'}.`,
    );
    return 'skipped';
  }
  if (!(await TrusteeDataReportLock.isCurrentRun(context, runId))) {
    await failRun(context, runId, 'The run did not hold the run lock when it started.');
    return 'skipped';
  }
  await reportRepo.upsertRun({ ...run, status: 'running', startedAt: new Date().toISOString() });
  return 'started';
}

type ComparedTrustee = { trustee: Trustee; truIds: string[] };

/**
 * Compares the appointments of the trustees compared on a page with the appointments the original
 * load would have created from their linked TOD records. One read each of TOD appointments, CAMS
 * appointments and offices.
 */
async function compareAppointments(
  context: ApplicationContext,
  compared: ComparedTrustee[],
): Promise<{ differences: TrusteeDataDifference[]; notTranslated: number }> {
  if (compared.length === 0) return { differences: [], notTranslated: 0 };

  const todIds = [...new Set(compared.flatMap(({ truIds }) => truIds))];
  const todResults = await factory
    .getAtsGateway(context)
    .getTrusteeAppointmentsByIds(context, todIds.map(Number).filter(Number.isInteger));
  const camsAppointments = await factory
    .getTrusteeAppointmentsRepository(context)
    .getAppointmentsByTrusteeIds(compared.map(({ trustee }) => trustee.trusteeId));
  const districtToDivisions = buildDistrictToDivisionsMap(
    await factory.getOfficesGateway(context).getOffices(context),
  );

  const differences = compared.flatMap(({ trustee, truIds }) => {
    // In truIds order: the order the load read them, so its first-wins choice is repeated.
    const todAppointmentsById = new Map(
      truIds.flatMap((id) => {
        const result = todResults.get(Number(id));
        return result ? [[id, result.cleanAppointments] as const] : [];
      }),
    );
    return compareTrusteeAppointments(
      trustee,
      camsAppointments.filter((appointment) => appointment.trusteeId === trustee.trusteeId),
      todAppointmentsById,
      districtToDivisions,
    );
  });
  const notTranslated = [...todResults.values()].reduce(
    (sum, { stats }) => sum + stats.skipped + stats.problematic + stats.uncleansable,
    0,
  );
  return { differences, notTranslated };
}

/**
 * Compares one page of TOD trustees (ID greater than cursor) with the CAMS trustees linked to
 * them. An empty page means TOD is exhausted, so the run is finalized and nextCursor is null.
 */
async function processPage(
  context: ApplicationContext,
  runId: string,
  cursor: number | null,
  pageSize: number = PAGE_SIZE,
): Promise<{ nextCursor: number | null }> {
  await requireLock(context, runId);
  const ats = factory.getAtsGateway(context);
  const page = await ats.getTrusteesPage(context, cursor, pageSize, true);
  if (page.length === 0) {
    await finalizeRun(context, runId);
    return { nextCursor: null };
  }

  const pageIds = new Set(page.map((record) => String(record.ID)));
  const linkedTrustees = await factory
    .getTrusteesRepository(context)
    .findTrusteesByLegacyTruIds([...pageIds]);
  const linkedIds = new Set(linkedTrustees.flatMap((trustee) => trustee.legacy?.truIds ?? []));

  // A merged CAMS trustee can link TOD records that are not on this page. Fetch them so the
  // primary-record choice sees every linked record.
  const offPageIds = [...linkedIds]
    .filter((id) => !pageIds.has(id))
    .map(Number)
    .filter(Number.isInteger);
  const offPage = offPageIds.length > 0 ? await ats.getTrusteesByIds(context, offPageIds) : [];
  const recordsById = new Map<string, AtsTrusteeRecord>(
    [...page, ...offPage].map((record) => [String(record.ID), record]),
  );

  const differences: TrusteeDataDifference[] = [];
  const compared: ComparedTrustee[] = [];
  for (const trustee of linkedTrustees) {
    const truIds = trustee.legacy?.truIds ?? [];
    const linkedRecords = truIds
      .map((id) => recordsById.get(id))
      .filter((record): record is AtsTrusteeRecord => !!record);
    // Pages run in ascending ID order, so comparing only on the page that holds the trustee's
    // lowest linked TOD ID compares each trustee exactly once.
    const lowestId = Math.min(...linkedRecords.map((record) => record.ID));
    if (!pageIds.has(String(lowestId))) continue;
    compared.push({ trustee, truIds });
    differences.push(...compareTrusteeProfile(trustee, linkedRecords));
  }
  const appointments = await compareAppointments(context, compared);
  differences.push(...appointments.differences);
  const trusteesCompared = compared.length;

  const unlinked = page.filter((record) => !linkedIds.has(String(record.ID)));
  if (unlinked.length > 0) {
    const candidates = new Map(
      (
        await ats.getTodOnlyCandidates(
          context,
          unlinked.map((record) => record.ID),
        )
      ).map((candidate) => [candidate.id, candidate]),
    );
    differences.push(
      ...findTodOnly(
        unlinked.map((record) => ({
          record,
          inScope: candidates.has(record.ID),
          statusMissing: candidates.get(record.ID)?.statusMissing,
        })),
        linkedIds,
      ),
    );
  }

  await recordPage(
    context,
    runId,
    pageKeyFor(cursor),
    differences,
    trusteesCompared,
    appointments.notTranslated,
  );
  context.logger.info(
    MODULE_NAME,
    `Run ${runId}: page after ${cursor ?? 'start'} read ${page.length} TOD trustees, compared ${trusteesCompared}, found ${differences.length} differences.`,
  );
  return { nextCursor: page[page.length - 1].ID };
}

/**
 * Finds CAMS trustees with no TOD record, completes the run, then removes every older completed
 * run and releases the lock. Failures after completion are logged, not thrown, so a completed run
 * is never marked failed; an older run that could not be removed is removed by the next run.
 */
async function finalizeRun(context: ApplicationContext, runId: string): Promise<void> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const trustees = await factory.getTrusteesRepository(context).listTrustees();
  const linkedTodIds = [...new Set(trustees.flatMap((trustee) => trustee.legacy?.truIds ?? []))]
    .map(Number)
    .filter(Number.isInteger);
  const existingTodIds = new Set(
    (await factory.getAtsGateway(context).getTrusteesByIds(context, linkedTodIds)).map((record) =>
      String(record.ID),
    ),
  );
  const camsOnly = findCamsOnly(trustees, existingTodIds);
  await recordPage(context, runId, FINALIZE_PAGE_KEY, camsOnly, 0, 0);

  const summary = (await reportRepo.readPageSummaries(runId)).reduce(
    addSummaries,
    summarize([], 0, 0),
  );
  const run = await requireRun(context, runId);
  await requireLock(context, runId);
  await reportRepo.upsertRun({
    ...run,
    status: 'completed',
    finishedAt: new Date().toISOString(),
    summary,
  });
  context.logger.info(
    MODULE_NAME,
    `Run ${runId} completed: ${camsOnly.length} CAMS trustees have no TOD record.`,
  );

  await removeOlderCompletedRuns(context, runId);
  try {
    await TrusteeDataReportLock.releaseRun(context, runId);
  } catch (error) {
    context.logger.warn(
      MODULE_NAME,
      `Run ${runId} completed but could not release the run lock; it goes stale after 2 hours: ${getCamsError(error, MODULE_NAME).message}`,
    );
  }
}

async function removeOlderCompletedRuns(context: ApplicationContext, runId: string) {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  let olderRunIds: string[];
  try {
    olderRunIds = (await reportRepo.listCompletedRunIds()).filter((id) => id !== runId);
  } catch (error) {
    context.logger.warn(
      MODULE_NAME,
      `Run ${runId} completed but could not list older runs to remove: ${getCamsError(error, MODULE_NAME).message}`,
    );
    return;
  }
  for (const olderRunId of olderRunIds) {
    try {
      await reportRepo.deleteRun(olderRunId);
    } catch (error) {
      context.logger.warn(
        MODULE_NAME,
        `Run ${runId} completed but could not remove older run ${olderRunId}: ${getCamsError(error, MODULE_NAME).message}`,
      );
    }
  }
}

/**
 * Marks a queued or running run failed and drops its partial results, leaving the previously
 * completed run untouched, then releases the lock if this run still holds it.
 *
 * A run that already finished is left as it is: a redelivered message, or a start replacing a
 * completed run whose lock release failed, must not turn completed results into a failure.
 * The run is rewritten as failed before its results are deleted, so a status check never sees
 * the run missing.
 */
async function failRun(context: ApplicationContext, runId: string, message: string): Promise<void> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const run = await reportRepo.readRun(runId);
  if (run?.status === 'completed' || run?.status === 'failed') {
    context.logger.warn(
      MODULE_NAME,
      `Run ${runId} already ${run.status}; not marking it failed (${message}).`,
    );
  } else {
    if (run) {
      await reportRepo.upsertRun({
        ...run,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        failureMessage: message,
        summary: undefined,
      });
      await reportRepo.deleteRunResults(runId);
    }
    context.logger.error(MODULE_NAME, `Run ${runId} failed: ${message}`);
  }
  await TrusteeDataReportLock.releaseRun(context, runId);
}

const RunTrusteeDataReport = { startRun, processPage, failRun };

export default RunTrusteeDataReport;
