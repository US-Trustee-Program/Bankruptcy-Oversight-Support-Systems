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

const MODULE_NAME = 'RUN-TRUSTEE-DATA-REPORT';

/** TOD trustees read per page message. */
const PAGE_SIZE = 100;

// This use case only reads trustees, appointments and TOD. Its only writes are to the
// trustee-data-report collection and the run lock.

function addSummaries(
  a: TrusteeDataReportSummary,
  b: TrusteeDataReportSummary,
): TrusteeDataReportSummary {
  const byField = { ...a.fieldDifferencesByField };
  for (const [field, count] of Object.entries(b.fieldDifferencesByField)) {
    byField[field as keyof typeof byField] += count;
  }
  return {
    trusteesCompared: a.trusteesCompared + b.trusteesCompared,
    todOnly: a.todOnly + b.todOnly,
    camsOnly: a.camsOnly + b.camsOnly,
    fieldDifferences: a.fieldDifferences + b.fieldDifferences,
    fieldDifferencesByField: byField,
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

/** Records a page's differences and adds its counts to the run's running summary. */
async function recordDifferences(
  context: ApplicationContext,
  runId: string,
  differences: TrusteeDataDifference[],
  trusteesCompared: number,
): Promise<void> {
  if (differences.length === 0 && trusteesCompared === 0) {
    return; // Nothing changed; rewriting the run would be a no-op replace.
  }
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  await reportRepo.insertDifferences(runId, differences);
  const run = await requireRun(context, runId);
  await reportRepo.upsertRun({
    ...run,
    summary: addSummaries(
      run.summary ?? summarize([], 0),
      summarize(differences, trusteesCompared),
    ),
  });
}

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
  let trusteesCompared = 0;
  for (const trustee of linkedTrustees) {
    const linkedRecords = (trustee.legacy?.truIds ?? [])
      .map((id) => recordsById.get(id))
      .filter((record): record is AtsTrusteeRecord => !!record);
    // Pages run in ascending ID order, so comparing only on the page that holds the trustee's
    // lowest linked TOD ID compares each trustee exactly once.
    const lowestId = Math.min(...linkedRecords.map((record) => record.ID));
    if (!pageIds.has(String(lowestId))) continue;
    trusteesCompared++;
    differences.push(...compareTrusteeProfile(trustee, linkedRecords));
  }

  const unlinked = page.filter((record) => !linkedIds.has(String(record.ID)));
  if (unlinked.length > 0) {
    const active = new Set(
      await ats.getActiveTrusteeIds(
        context,
        unlinked.map((record) => record.ID),
      ),
    );
    differences.push(
      ...findTodOnly(
        unlinked.map((record) => ({ record, inScope: active.has(record.ID) })),
        linkedIds,
      ),
    );
  }

  await recordDifferences(context, runId, differences, trusteesCompared);
  context.logger.info(
    MODULE_NAME,
    `Run ${runId}: page after ${cursor ?? 'start'} read ${page.length} TOD trustees, compared ${trusteesCompared}, found ${differences.length} differences.`,
  );
  return { nextCursor: page[page.length - 1].ID };
}

/**
 * Finds CAMS trustees with no TOD record, completes the run, then replaces the previously
 * completed run and releases the lock. Failures after completion are logged, not thrown, so a
 * completed run is never marked failed.
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
  await recordDifferences(context, runId, camsOnly, 0);

  const previous = await reportRepo.readLatestCompletedRun();
  const run = await requireRun(context, runId);
  await reportRepo.upsertRun({
    ...run,
    status: 'completed',
    finishedAt: new Date().toISOString(),
    summary: run.summary ?? summarize([], 0),
  });
  context.logger.info(
    MODULE_NAME,
    `Run ${runId} completed: ${camsOnly.length} CAMS trustees have no TOD record.`,
  );

  if (previous && previous.runId !== runId) {
    try {
      await reportRepo.deleteRun(previous.runId);
    } catch (error) {
      context.logger.warn(
        MODULE_NAME,
        `Run ${runId} completed but could not remove previous run ${previous.runId}: ${getCamsError(error, MODULE_NAME).message}`,
      );
    }
  }
  try {
    await TrusteeDataReportLock.releaseRun(context, runId);
  } catch (error) {
    context.logger.warn(
      MODULE_NAME,
      `Run ${runId} completed but could not release the run lock; it goes stale after 2 hours: ${getCamsError(error, MODULE_NAME).message}`,
    );
  }
}

/**
 * Marks a run failed and drops its partial rows, leaving the previously completed run and its
 * rows untouched, then releases the lock if this run still holds it.
 */
async function failRun(context: ApplicationContext, runId: string, message: string): Promise<void> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const run = await reportRepo.readRun(runId);
  if (run) {
    await reportRepo.deleteRun(runId);
    await reportRepo.upsertRun({
      ...run,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      failureMessage: message,
      summary: undefined,
    });
  }
  await TrusteeDataReportLock.releaseRun(context, runId);
  context.logger.error(MODULE_NAME, `Run ${runId} failed: ${message}`);
}

const RunTrusteeDataReport = { startRun, processPage, failRun };

export default RunTrusteeDataReport;
