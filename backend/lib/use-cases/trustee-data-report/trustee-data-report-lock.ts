import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { TrusteeDataReportRunState } from '../gateways.types';

// The lock lets one trustee data report run at a time. Starting a run claims it; the dataflow
// checks it on every page and releases it when the run completes or fails.
const DOCUMENT_TYPE = 'TRUSTEE_DATA_REPORT_RUN';

/** A run that holds the lock this long has crashed or stalled, so a new start may take over. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** How long a claim waits before reading the lock back, so a competing write can land first. */
export const CLAIM_CONFIRM_DELAY_MS = 2000;

type ClaimResult =
  { claimed: true; replacedStaleRunId?: string } | { claimed: false; activeRunId: string };

function lockRepo(context: ApplicationContext) {
  return factory.getRuntimeStateRepository<TrusteeDataReportRunState>(context);
}

async function readLock(context: ApplicationContext): Promise<TrusteeDataReportRunState | null> {
  try {
    return await lockRepo(context).read(DOCUMENT_TYPE);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function isStale(lock: TrusteeDataReportRunState): boolean {
  return Date.now() - new Date(lock.startedAt).getTime() > STALE_AFTER_MS;
}

/**
 * Claims the lock for runId unless another run holds a lock younger than 2 hours. Two starts can
 * both see no lock and both write, with the last write winning, so a claim is confirmed: after a
 * short pause it reads the lock back and only the start whose runId survived proceeds. This
 * narrows the race window; it does not close it. Same pattern as trustee-appointment-sync-run.ts.
 */
async function claimRun(context: ApplicationContext, runId: string): Promise<ClaimResult> {
  const existing = await readLock(context);
  if (existing && existing.runId !== runId && !isStale(existing)) {
    return { claimed: false, activeRunId: existing.runId };
  }
  await lockRepo(context).upsert({
    documentType: DOCUMENT_TYPE,
    runId,
    startedAt: new Date().toISOString(),
  });
  await new Promise((resolve) => setTimeout(resolve, CLAIM_CONFIRM_DELAY_MS));
  const confirmed = await readLock(context);
  if (confirmed?.runId !== runId) {
    return { claimed: false, activeRunId: confirmed?.runId ?? 'unknown' };
  }
  return existing && existing.runId !== runId
    ? { claimed: true, replacedStaleRunId: existing.runId }
    : { claimed: true };
}

/** The run holding a lock younger than 2 hours, or null. */
async function activeRunId(context: ApplicationContext): Promise<string | null> {
  const lock = await readLock(context);
  return lock && !isStale(lock) ? lock.runId : null;
}

/** True while runId holds the lock; a run that lost it must stop. */
async function isCurrentRun(context: ApplicationContext, runId: string): Promise<boolean> {
  return (await readLock(context))?.runId === runId;
}

/** Releases the lock if runId still holds it; a lock taken over by another run is left alone. */
async function releaseRun(context: ApplicationContext, runId: string): Promise<void> {
  if (await isCurrentRun(context, runId)) {
    await lockRepo(context).delete(DOCUMENT_TYPE);
  }
}

const TrusteeDataReportLock = { claimRun, activeRunId, isCurrentRun, releaseRun };

export default TrusteeDataReportLock;
