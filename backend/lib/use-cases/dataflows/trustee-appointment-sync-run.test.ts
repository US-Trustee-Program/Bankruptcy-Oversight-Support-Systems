import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { TrusteeAppointmentSyncRunState } from '../gateways.types';
import TrusteeAppointmentSyncRun, { CLAIM_CONFIRM_DELAY_MS } from './trustee-appointment-sync-run';

function runState(runId: string, lanesRemaining = 1): TrusteeAppointmentSyncRunState {
  return {
    documentType: 'TRUSTEE_APPOINTMENT_SYNC_RUN',
    runId,
    startedAt: '2026-11-10T12:30:00.000Z',
    lanesRemaining,
  };
}

describe('trustee appointment sync run lock', () => {
  let store: TrusteeAppointmentSyncRunState | undefined;
  const read = vi.fn();
  const upsert = vi.fn();
  const setField = vi.fn();
  const atomicDecrement = vi.fn();
  const del = vi.fn();

  async function createDeps(initial?: TrusteeAppointmentSyncRunState) {
    store = initial;
    read.mockImplementation(async () => {
      if (!store) throw new NotFoundError('TEST');
      return store;
    });
    upsert.mockImplementation(async (doc) => {
      store = doc;
    });
    setField.mockImplementation(async (_type, path, value) => {
      store = { ...store, [path]: value } as TrusteeAppointmentSyncRunState;
    });
    atomicDecrement.mockImplementation(async () => {
      store = { ...store!, lanesRemaining: store!.lanesRemaining - 1 };
      return store.lanesRemaining;
    });
    del.mockImplementation(async () => {
      store = undefined;
    });
    const context = await createMockApplicationContext();
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue({
      read,
      upsert,
      setField,
      atomicDecrement,
      delete: del,
    } as never);
    return TrusteeAppointmentSyncRun.createDeps(context);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    [read, upsert, setField, atomicDecrement, del].forEach((fn) => fn.mockReset());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('claimRun', () => {
    async function claim(deps: Awaited<ReturnType<typeof createDeps>>, runId: string) {
      const pending = TrusteeAppointmentSyncRun.claimRun(deps, runId);
      await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS);
      return pending;
    }

    test('claims the run with one lane remaining when no lock exists', async () => {
      const deps = await createDeps();

      const result = await claim(deps, 'run-a');

      expect(result).toEqual({ claimed: true, runId: 'run-a' });
      expect(store).toEqual({
        documentType: 'TRUSTEE_APPOINTMENT_SYNC_RUN',
        runId: 'run-a',
        startedAt: '2026-11-10T12:30:00.000Z',
        lanesRemaining: 1,
      });
    });

    test('does not claim while a different run holds the lock, however old it is', async () => {
      const deps = await createDeps(runState('run-a'));
      vi.setSystemTime(new Date('2026-12-25T00:00:00.000Z'));

      const result = await claim(deps, 'run-b');

      expect(result).toEqual({ claimed: false, activeRunId: 'run-a' });
      expect(upsert).not.toHaveBeenCalled();
    });

    test('lets a start that already owns the lock proceed without rewriting it', async () => {
      const deps = await createDeps(runState('run-a', 3));

      const result = await TrusteeAppointmentSyncRun.claimRun(deps, 'run-a');

      expect(result).toEqual({ claimed: true, runId: 'run-a' });
      expect(upsert).not.toHaveBeenCalled();
    });

    test('waits before confirming so a competing write has time to land', async () => {
      const deps = await createDeps();

      const pending = TrusteeAppointmentSyncRun.claimRun(deps, 'run-a');
      await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS - 1);
      expect(read).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;

      expect(read).toHaveBeenCalledTimes(2);
    });

    test('loses the claim when a competing write replaced the lock before the confirm read', async () => {
      const deps = await createDeps();
      upsert.mockImplementationOnce(async () => {
        store = runState('run-competitor');
      });

      const result = await claim(deps, 'run-a');

      expect(result).toEqual({ claimed: false, activeRunId: 'run-competitor' });
    });

    test('propagates a read failure instead of treating it as no lock', async () => {
      const deps = await createDeps();
      read.mockRejectedValue(new TooManyRequestsError('TEST'));

      await expect(TrusteeAppointmentSyncRun.claimRun(deps, 'run-a')).rejects.toThrow();
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('isCurrentRun', () => {
    test('is true when the lock holds the run id', async () => {
      const deps = await createDeps(runState('run-a'));
      expect(await TrusteeAppointmentSyncRun.isCurrentRun(deps, 'run-a')).toBe(true);
    });

    test('is false when a different run holds the lock', async () => {
      const deps = await createDeps(runState('run-b'));
      expect(await TrusteeAppointmentSyncRun.isCurrentRun(deps, 'run-a')).toBe(false);
    });

    test('is false when there is no lock', async () => {
      const deps = await createDeps();
      expect(await TrusteeAppointmentSyncRun.isCurrentRun(deps, 'run-a')).toBe(false);
    });
  });

  describe('setLanesRemaining', () => {
    test('records the number of lanes the run is waiting on', async () => {
      const deps = await createDeps(runState('run-a'));

      await TrusteeAppointmentSyncRun.setLanesRemaining(deps, 3);

      expect(setField).toHaveBeenCalledWith('TRUSTEE_APPOINTMENT_SYNC_RUN', 'lanesRemaining', 3);
      expect(del).not.toHaveBeenCalled();
    });

    test('releases the lock when there are no lanes to wait on', async () => {
      const deps = await createDeps(runState('run-a'));

      await TrusteeAppointmentSyncRun.setLanesRemaining(deps, 0);

      expect(del).toHaveBeenCalledWith('TRUSTEE_APPOINTMENT_SYNC_RUN');
      expect(setField).not.toHaveBeenCalled();
    });
  });

  describe('completeLane', () => {
    test('keeps the lock while other lanes are still running', async () => {
      const deps = await createDeps(runState('run-a', 3));

      await TrusteeAppointmentSyncRun.completeLane(deps, 'run-a');

      expect(store?.lanesRemaining).toBe(2);
      expect(del).not.toHaveBeenCalled();
    });

    test('releases the lock when the last lane completes', async () => {
      const deps = await createDeps(runState('run-a', 1));

      await TrusteeAppointmentSyncRun.completeLane(deps, 'run-a');

      expect(del).toHaveBeenCalledWith('TRUSTEE_APPOINTMENT_SYNC_RUN');
      expect(store).toBeUndefined();
    });

    test('does nothing when the lock belongs to another run or was cleared', async () => {
      const deps = await createDeps(runState('run-b', 1));
      await TrusteeAppointmentSyncRun.completeLane(deps, 'run-a');
      store = undefined;
      await TrusteeAppointmentSyncRun.completeLane(deps, 'run-a');

      expect(atomicDecrement).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });
  });
});
