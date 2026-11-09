import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { TrusteeAppointmentSyncRunState } from '../gateways.types';
import TrusteeAppointmentSyncRun, { RUN_STALE_AFTER_MS } from './trustee-appointment-sync-run';

const NOW = new Date('2026-11-10T12:30:00.000Z');

function runState(runId: string, lastActivityAt: Date): TrusteeAppointmentSyncRunState {
  return {
    documentType: 'TRUSTEE_APPOINTMENT_SYNC_RUN',
    runId,
    startedAt: new Date(lastActivityAt.getTime() - 60_000).toISOString(),
    lastActivityAt: lastActivityAt.toISOString(),
  };
}

describe('trustee appointment sync run lock', () => {
  const read = vi.fn();
  const upsert = vi.fn();

  async function createDeps() {
    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue({
      read,
      upsert,
    } as never);
    return TrusteeAppointmentSyncRun.createDeps(context);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    read.mockReset();
    upsert.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('claimRun', () => {
    test('claims a new run when no run has ever been recorded', async () => {
      read.mockRejectedValue(new NotFoundError('TEST'));
      const deps = await createDeps();

      const result = await TrusteeAppointmentSyncRun.claimRun(deps);

      expect(result.claimed).toBe(true);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_APPOINTMENT_SYNC_RUN',
          runId: (result as { runId: string }).runId,
          startedAt: NOW.toISOString(),
          lastActivityAt: NOW.toISOString(),
        }),
      );
    });

    test('does not claim while another run was active within the stale window', async () => {
      read.mockResolvedValue(runState('run-a', new Date(NOW.getTime() - RUN_STALE_AFTER_MS + 1)));
      const deps = await createDeps();

      const result = await TrusteeAppointmentSyncRun.claimRun(deps);

      expect(result).toEqual({ claimed: false, activeRunId: 'run-a' });
      expect(upsert).not.toHaveBeenCalled();
    });

    test('claims a new run once the previous run has been silent for the stale window', async () => {
      read.mockResolvedValue(runState('run-a', new Date(NOW.getTime() - RUN_STALE_AFTER_MS)));
      const deps = await createDeps();

      const result = await TrusteeAppointmentSyncRun.claimRun(deps);

      expect(result.claimed).toBe(true);
      expect((result as { runId: string }).runId).not.toEqual('run-a');
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    test('lets a requeued kickoff re-claim the run it already owns', async () => {
      read.mockResolvedValue(runState('run-a', new Date(NOW.getTime() - 1000)));
      const deps = await createDeps();

      const result = await TrusteeAppointmentSyncRun.claimRun(deps, 'run-a');

      expect(result).toEqual({ claimed: true, runId: 'run-a' });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-a', lastActivityAt: NOW.toISOString() }),
      );
    });

    test('does not let a requeued kickoff override a different active run', async () => {
      read.mockResolvedValue(runState('run-b', new Date(NOW.getTime() - 1000)));
      const deps = await createDeps();

      const result = await TrusteeAppointmentSyncRun.claimRun(deps, 'run-a');

      expect(result).toEqual({ claimed: false, activeRunId: 'run-b' });
      expect(upsert).not.toHaveBeenCalled();
    });

    test('propagates a read failure instead of treating it as no active run', async () => {
      read.mockRejectedValue(new TooManyRequestsError('TEST'));
      const deps = await createDeps();

      await expect(TrusteeAppointmentSyncRun.claimRun(deps)).rejects.toThrow();
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('touchRun', () => {
    test('refreshes lastActivityAt and returns true when the run is the current one', async () => {
      const state = runState('run-a', new Date(NOW.getTime() - 5000));
      read.mockResolvedValue(state);
      const deps = await createDeps();

      const current = await TrusteeAppointmentSyncRun.touchRun(deps, 'run-a');

      expect(current).toBe(true);
      expect(upsert).toHaveBeenCalledWith({ ...state, lastActivityAt: NOW.toISOString() });
    });

    test('returns false and writes nothing when a different run holds the lock', async () => {
      read.mockResolvedValue(runState('run-b', new Date(NOW.getTime() - 5000)));
      const deps = await createDeps();

      const current = await TrusteeAppointmentSyncRun.touchRun(deps, 'run-a');

      expect(current).toBe(false);
      expect(upsert).not.toHaveBeenCalled();
    });

    test('returns false when no run is recorded', async () => {
      read.mockRejectedValue(new NotFoundError('TEST'));
      const deps = await createDeps();

      expect(await TrusteeAppointmentSyncRun.touchRun(deps, 'run-a')).toBe(false);
    });
  });
});
