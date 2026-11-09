import { randomUUID } from 'node:crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { TrusteeAppointmentSyncRunState } from '../gateways.types';

const DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_SYNC_RUN';

/**
 * A run is treated as finished once nothing has touched it for this long. It covers one 56-minute
 * invocation budget slice and the longest transient-requeue streak (5 x 300s) with room to spare,
 * and is short enough that the next daily kickoff is never blocked by a run that already ended.
 */
export const RUN_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** How long a claim waits before reading the lock back, so a competing write can land first. */
export const CLAIM_CONFIRM_DELAY_MS = 2000;

function createDeps(context: ApplicationContext) {
  return {
    runStateRepo: factory.getRuntimeStateRepository<TrusteeAppointmentSyncRunState>(context),
  };
}

type RunDeps = ReturnType<typeof createDeps>;

export type ClaimResult =
  { claimed: true; runId: string } | { claimed: false; activeRunId: string };

async function readRun(deps: RunDeps): Promise<TrusteeAppointmentSyncRunState | undefined> {
  try {
    return await deps.runStateRepo.read(DOCUMENT_TYPE);
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isActive(run: TrusteeAppointmentSyncRunState): boolean {
  return Date.now() - new Date(run.lastActivityAt).getTime() < RUN_STALE_AFTER_MS;
}

/**
 * Called by any start message that has no runId (a timer kickoff or an operator start). Claims the
 * run unless a different run is still active. Two starts can pass the active check together and
 * both write, with the last write winning, so the claim is confirmed: after a short pause it reads
 * the lock back, and only the start whose runId survived proceeds. The other no-ops.
 */
async function claimRun(deps: RunDeps): Promise<ClaimResult> {
  const existing = await readRun(deps);
  if (existing && isActive(existing)) {
    return { claimed: false, activeRunId: existing.runId };
  }
  const now = new Date().toISOString();
  const runId = randomUUID();
  await deps.runStateRepo.upsert({
    documentType: DOCUMENT_TYPE,
    runId,
    startedAt: now,
    lastActivityAt: now,
  });
  await new Promise((resolve) => setTimeout(resolve, CLAIM_CONFIRM_DELAY_MS));
  const confirmed = await readRun(deps);
  if (confirmed?.runId !== runId) {
    return { claimed: false, activeRunId: confirmed?.runId ?? 'unknown' };
  }
  return { claimed: true, runId };
}

/**
 * Called by every lane message. Returns true and records activity when runId is the current run;
 * false means a newer run owns the sync and this message should stop.
 */
async function touchRun(deps: RunDeps, runId: string): Promise<boolean> {
  const existing = await readRun(deps);
  if (existing?.runId !== runId) {
    return false;
  }
  await deps.runStateRepo.upsert({ ...existing, lastActivityAt: new Date().toISOString() });
  return true;
}

const TrusteeAppointmentSyncRun = {
  createDeps,
  claimRun,
  touchRun,
};

export default TrusteeAppointmentSyncRun;
