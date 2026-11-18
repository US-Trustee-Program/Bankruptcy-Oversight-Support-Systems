import { vi } from 'vitest';
import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import { RuntimeStateRepository, TrusteeDataReportRunState } from '../gateways.types';
import TrusteeDataReportLock, { CLAIM_CONFIRM_DELAY_MS } from './trustee-data-report-lock';

const HOUR_MS = 60 * 60 * 1000;

class InMemoryLockRepository {
  doc: TrusteeDataReportRunState | null = null;

  async read() {
    if (!this.doc) throw new NotFoundError('TEST');
    return this.doc;
  }
  async upsert(doc: TrusteeDataReportRunState) {
    this.doc = doc;
    return doc;
  }
  async delete() {
    this.doc = null;
  }
}

function lockHeldBy(runId: string, ageMs: number): TrusteeDataReportRunState {
  return {
    documentType: 'TRUSTEE_DATA_REPORT_RUN',
    runId,
    startedAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

describe('TrusteeDataReportLock', () => {
  let context: ApplicationContext;
  let lockRepo: InMemoryLockRepository;

  async function claim(runId: string) {
    const result = TrusteeDataReportLock.claimRun(context, runId);
    await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS);
    return result;
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    context = await createMockApplicationContext();
    lockRepo = new InMemoryLockRepository();
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
      lockRepo as unknown as RuntimeStateRepository,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('claimRun', () => {
    test('should claim the lock when no run holds it', async () => {
      expect(await claim('run-new')).toEqual({ claimed: true });
      expect(lockRepo.doc).toEqual(expect.objectContaining({ runId: 'run-new' }));
    });

    test('should refuse while another run holds a lock younger than 2 hours', async () => {
      lockRepo.doc = lockHeldBy('run-active', HOUR_MS);

      expect(await claim('run-new')).toEqual({ claimed: false, activeRunId: 'run-active' });
      expect(lockRepo.doc?.runId).toBe('run-active');
    });

    test('should take over a lock older than 2 hours and name the run it replaced', async () => {
      lockRepo.doc = lockHeldBy('run-crashed', 2 * HOUR_MS + 1);

      expect(await claim('run-new')).toEqual({ claimed: true, replacedStaleRunId: 'run-crashed' });
      expect(lockRepo.doc?.runId).toBe('run-new');
    });

    test('should report a lost race when another start overwrote the claim during the confirm pause', async () => {
      // The competing write lands partway through the pause, so this fails if the pause is removed.
      setTimeout(() => {
        lockRepo.doc = lockHeldBy('run-other', 0);
      }, CLAIM_CONFIRM_DELAY_MS / 2);

      expect(await claim('run-new')).toEqual({ claimed: false, activeRunId: 'run-other' });
    });
  });

  describe('activeRunId', () => {
    test.each([
      { label: 'no lock', doc: null, expected: null },
      { label: 'a fresh lock', doc: lockHeldBy('run-active', HOUR_MS), expected: 'run-active' },
      { label: 'a stale lock', doc: lockHeldBy('run-crashed', 3 * HOUR_MS), expected: null },
    ])('should return $expected for $label', async ({ doc, expected }) => {
      lockRepo.doc = doc;

      expect(await TrusteeDataReportLock.activeRunId(context)).toBe(expected);
    });
  });
});
