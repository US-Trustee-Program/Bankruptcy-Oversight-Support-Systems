import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { TrusteeAppointmentSyncRunState } from '../gateways.types';
import TrusteeAppointmentSyncRun, {
  CLAIM_CONFIRM_DELAY_MS,
  RUN_STALE_AFTER_MS,
} from './trustee-appointment-sync-run';

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
    // An in-memory lock document behind read/upsert, so the confirm read sees what was written.
    function useStore(initial?: TrusteeAppointmentSyncRunState) {
      let store = initial;
      read.mockImplementation(async () => {
        if (!store) throw new NotFoundError('TEST');
        return store;
      });
      upsert.mockImplementation(async (doc) => {
        store = doc;
      });
      return {
        overwrite: (doc: TrusteeAppointmentSyncRunState) => {
          store = doc;
        },
        current: () => store,
      };
    }

    async function claim(deps: Awaited<ReturnType<typeof createDeps>>) {
      const pending = TrusteeAppointmentSyncRun.claimRun(deps);
      await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS);
      return pending;
    }

    test('claims a new run when no run has ever been recorded', async () => {
      const store = useStore();
      const deps = await createDeps();

      const result = await claim(deps);

      expect(result.claimed).toBe(true);
      expect(store.current()).toEqual({
        documentType: 'TRUSTEE_APPOINTMENT_SYNC_RUN',
        runId: (result as { runId: string }).runId,
        startedAt: NOW.toISOString(),
        lastActivityAt: NOW.toISOString(),
      });
    });

    test('does not claim while another run was active within the stale window', async () => {
      useStore(runState('run-a', new Date(NOW.getTime() - RUN_STALE_AFTER_MS + 1)));
      const deps = await createDeps();

      const result = await claim(deps);

      expect(result).toEqual({ claimed: false, activeRunId: 'run-a' });
      expect(upsert).not.toHaveBeenCalled();
    });

    test('claims a new run once the previous run has been silent for the stale window', async () => {
      useStore(runState('run-a', new Date(NOW.getTime() - RUN_STALE_AFTER_MS)));
      const deps = await createDeps();

      const result = await claim(deps);

      expect(result.claimed).toBe(true);
      expect((result as { runId: string }).runId).not.toEqual('run-a');
    });

    test('waits before confirming so a competing write has time to land', async () => {
      useStore();
      const deps = await createDeps();

      const pending = TrusteeAppointmentSyncRun.claimRun(deps);
      await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS - 1);
      expect(read).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;

      expect(read).toHaveBeenCalledTimes(2);
    });

    test('loses the claim when a competing write replaced the lock before the confirm read', async () => {
      const store = useStore();
      upsert.mockImplementationOnce(async () => {
        // The competitor's write lands after ours and wins.
        store.overwrite(runState('run-competitor', NOW));
      });
      const deps = await createDeps();

      const result = await claim(deps);

      expect(result).toEqual({ claimed: false, activeRunId: 'run-competitor' });
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
