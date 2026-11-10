import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { TrusteeAppointmentSyncRunState } from '../gateways.types';

const DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_SYNC_RUN';

/** How long a claim waits before reading the lock back, so a competing write can land first. */
export const CLAIM_CONFIRM_DELAY_MS = 2000;

function createDeps(context: ApplicationContext) {
  return {
    runStateRepo: factory.getRuntimeStateRepository<TrusteeAppointmentSyncRunState>(context),
  };
}

type RunDeps = ReturnType<typeof createDeps>;

type ClaimResult = { claimed: true; runId: string } | { claimed: false; activeRunId: string };

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

/**
 * Called by every start that is not a lane of a running sync (timer kickoff, operator start, or a
 * requeue of either). The lock never expires, so a run that died keeps blocking new starts until
 * an operator deletes the TRUSTEE_APPOINTMENT_SYNC_RUN runtime-state document.
 *
 * The caller mints runId and keeps it on every requeue, so a start whose claim failed partway can
 * pick its own lock back up. Two starts can both see no lock and both write, with the last write
 * winning, so a new claim is confirmed: after a short pause it reads the lock back and only the
 * start whose runId survived proceeds. This narrows the race window; it does not close it.
 */
async function claimRun(deps: RunDeps, runId: string): Promise<ClaimResult> {
  const existing = await readRun(deps);
  if (existing) {
    return existing.runId === runId
      ? { claimed: true, runId }
      : { claimed: false, activeRunId: existing.runId };
  }
  await deps.runStateRepo.upsert({
    documentType: DOCUMENT_TYPE,
    runId,
    startedAt: new Date().toISOString(),
    lanesRemaining: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, CLAIM_CONFIRM_DELAY_MS));
  const confirmed = await readRun(deps);
  if (confirmed?.runId !== runId) {
    return { claimed: false, activeRunId: confirmed?.runId ?? 'unknown' };
  }
  return { claimed: true, runId };
}

/** True while runId still holds the lock; a lane message for any other run should stop. */
async function isCurrentRun(deps: RunDeps, runId: string): Promise<boolean> {
  return (await readRun(deps))?.runId === runId;
}

/** Called by a fan-out before it sends lanes. With no lanes to wait on, the run is already done. */
async function setLanesRemaining(deps: RunDeps, laneCount: number): Promise<void> {
  if (laneCount === 0) {
    await deps.runStateRepo.delete(DOCUMENT_TYPE);
    return;
  }
  await deps.runStateRepo.setField(DOCUMENT_TYPE, 'lanesRemaining', laneCount);
}

/** Called when a lane's chain finishes with nothing left to continue. The last one releases the lock. */
async function completeLane(deps: RunDeps, runId: string): Promise<void> {
  if (!(await isCurrentRun(deps, runId))) {
    return;
  }
  const remaining = await deps.runStateRepo.atomicDecrement(DOCUMENT_TYPE, 'lanesRemaining', 0);
  if (remaining <= 0) {
    await deps.runStateRepo.delete(DOCUMENT_TYPE);
  }
}

const TrusteeAppointmentSyncRun = {
  createDeps,
  claimRun,
  isCurrentRun,
  setLanesRemaining,
  completeLane,
};

export default TrusteeAppointmentSyncRun;
