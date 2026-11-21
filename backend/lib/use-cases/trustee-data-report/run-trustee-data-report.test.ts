import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { Trustee } from '@common/cams/trustees';
import {
  TrusteeDataDifference,
  TrusteeDataReportRun,
  TrusteeDataReportSummary,
} from '@common/cams/trustee-data-report';
import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockAtsGateway, mockAtsTrusteeRecord } from '../../adapters/gateways/ats/ats.mock.gateway';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';
import { NotFoundError } from '../../common-errors/not-found-error';
import {
  RuntimeStateRepository,
  TrusteeDataReportRepository,
  TrusteeDataReportRunState,
} from '../gateways.types';
import RunTrusteeDataReport from './run-trustee-data-report';

class InMemoryReportRepository implements TrusteeDataReportRepository {
  runs = new Map<string, TrusteeDataReportRun>();
  rows: (TrusteeDataDifference & { runId: string; pageKey: string })[] = [];
  pages: { runId: string; pageKey: string; summary: TrusteeDataReportSummary }[] = [];

  async upsertRun(run: TrusteeDataReportRun) {
    this.runs.set(run.runId, structuredClone(run));
  }
  async readRun(runId: string) {
    return this.runs.get(runId) ?? null;
  }
  async readLatestCompletedRun() {
    return this.latestWithStatus('completed');
  }
  async readLatestFailedRun() {
    return this.latestWithStatus('failed');
  }
  async listCompletedRunIds() {
    return [...this.runs.values()].filter((run) => run.status === 'completed').map((r) => r.runId);
  }
  private latestWithStatus(status: TrusteeDataReportRun['status']) {
    const runs = [...this.runs.values()].filter((run) => run.status === status);
    runs.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    return runs[0] ?? null;
  }
  async replacePageResults(
    runId: string,
    pageKey: string,
    differences: TrusteeDataDifference[],
    summary: TrusteeDataReportSummary,
  ) {
    const otherPage = (doc: { runId: string; pageKey: string }) =>
      doc.runId !== runId || doc.pageKey !== pageKey;
    this.rows = [
      ...this.rows.filter(otherPage),
      ...differences.map((difference) => ({ ...difference, runId, pageKey })),
    ];
    this.pages = [...this.pages.filter(otherPage), { runId, pageKey, summary }];
  }
  async readPageSummaries(runId: string) {
    return this.pages.filter((page) => page.runId === runId).map((page) => page.summary);
  }
  async deleteRunResults(runId: string) {
    this.rows = this.rows.filter((row) => row.runId !== runId);
    this.pages = this.pages.filter((page) => page.runId !== runId);
  }
  async deleteRun(runId: string) {
    this.runs.delete(runId);
    await this.deleteRunResults(runId);
  }
  /** Test setup: rows of an earlier run. */
  seedRows(runId: string, differences: TrusteeDataDifference[]) {
    this.rows.push(...differences.map((difference) => ({ ...difference, runId, pageKey: 'seed' })));
  }
  rowsFor(runId: string) {
    return this.rows.filter((row) => row.runId === runId);
  }
  release() {}
}

class InMemoryLockRepository {
  docs = new Map<string, TrusteeDataReportRunState>();

  async read(documentType: string) {
    const doc = this.docs.get(documentType);
    if (!doc) throw new NotFoundError('TEST');
    return doc;
  }
  async upsert(doc: TrusteeDataReportRunState) {
    this.docs.set(doc.documentType, doc);
    return doc;
  }
  async delete(documentType: string) {
    this.docs.delete(documentType);
  }
  holder() {
    return this.docs.get('TRUSTEE_DATA_REPORT_RUN')?.runId;
  }
}

/** A CAMS trustee exactly as the migration built it from a mock TOD record. */
function migrated(todId: number, override: Partial<Trustee> = {}): Trustee {
  const input = transformTrusteeRecord(mockAtsTrusteeRecord(todId));
  return MockData.getTrustee({
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    name: input.name,
    public: input.public,
    internal: input.internal,
    legacy: { truIds: [String(todId)] },
    ...override,
  });
}

const RUN_ID = 'run-new';

function queuedRun(runId = RUN_ID): TrusteeDataReportRun {
  return {
    runId,
    status: 'queued',
    startedBy: { id: 'user-1', name: 'Test SuperUser' },
    queuedAt: '2026-11-17T10:00:00.000Z',
  };
}

describe('RunTrusteeDataReport', () => {
  let context: ApplicationContext;
  let reportRepo: InMemoryReportRepository;
  let lockRepo: InMemoryLockRepository;
  let trusteesRepo: MockMongoRepository;
  let ats: MockAtsGateway;
  let camsTrustees: Trustee[];

  const unchanged = migrated(1);
  const changedPhone = migrated(2);
  changedPhone.public = { ...changedPhone.public, phone: { number: '555-010-0199' } };
  const formattingOnly = migrated(3);
  formattingOnly.public = { ...formattingOnly.public, phone: { number: '(555) 0003' } };
  const noTruIds = MockData.getTrustee({ legacy: undefined });
  const missingInTod = MockData.getTrustee({ legacy: { truIds: ['99'] } });

  function linkedTo(ids: string[]) {
    return camsTrustees.filter((trustee) =>
      (trustee.legacy?.truIds ?? []).some((id) => ids.includes(id)),
    );
  }

  async function runToCompletion(pageSize: number): Promise<(number | null)[]> {
    await RunTrusteeDataReport.startRun(context, RUN_ID);
    const cursors: (number | null)[] = [];
    let cursor: number | null = null;
    do {
      ({ nextCursor: cursor } = await RunTrusteeDataReport.processPage(
        context,
        RUN_ID,
        cursor,
        pageSize,
      ));
      cursors.push(cursor);
    } while (cursor !== null);
    return cursors;
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    reportRepo = new InMemoryReportRepository();
    lockRepo = new InMemoryLockRepository();
    trusteesRepo = new MockMongoRepository();
    ats = MockAtsGateway.getInstance();
    camsTrustees = [unchanged, changedPhone, formattingOnly, noTruIds, missingInTod];

    vi.spyOn(factory, 'getTrusteeDataReportRepository').mockReturnValue(reportRepo);
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
      lockRepo as unknown as RuntimeStateRepository,
    );
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(trusteesRepo);
    vi.spyOn(factory, 'getAtsGateway').mockReturnValue(ats);
    vi.spyOn(trusteesRepo, 'findTrusteesByLegacyTruIds').mockImplementation(async (ids) =>
      linkedTo(ids),
    );
    vi.spyOn(trusteesRepo, 'listTrustees').mockImplementation(async () => camsTrustees);

    await reportRepo.upsertRun(queuedRun());
    await lockRepo.upsert({
      documentType: 'TRUSTEE_DATA_REPORT_RUN',
      runId: RUN_ID,
      startedAt: '2026-11-17T10:00:00.000Z',
    });
  });

  describe('startRun', () => {
    test('should move a queued run to running', async () => {
      expect(await RunTrusteeDataReport.startRun(context, RUN_ID)).toBe('started');

      const run = await reportRepo.readRun(RUN_ID);
      expect(run).toEqual(
        expect.objectContaining({ status: 'running', startedAt: expect.any(String) }),
      );
    });

    test('should skip a run that is no longer queued, such as a redelivered start', async () => {
      await reportRepo.upsertRun({ ...queuedRun(), status: 'running' });
      const upsertSpy = vi.spyOn(reportRepo, 'upsertRun');

      expect(await RunTrusteeDataReport.startRun(context, RUN_ID)).toBe('skipped');
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('should skip a run that does not exist', async () => {
      expect(await RunTrusteeDataReport.startRun(context, 'missing')).toBe('skipped');
    });

    test('should fail a run that does not hold the lock', async () => {
      lockRepo.docs.clear();

      expect(await RunTrusteeDataReport.startRun(context, RUN_ID)).toBe('skipped');
      expect(await reportRepo.readRun(RUN_ID)).toEqual(
        expect.objectContaining({ status: 'failed', failureMessage: expect.any(String) }),
      );
    });
  });

  describe('a full run', () => {
    test('should page through TOD in cursor order until a page is empty', async () => {
      expect(await runToCompletion(2)).toEqual([2, 4, 6, null]);
    });

    test('should report tod-only, cams-only and field differences', async () => {
      await runToCompletion(2);

      const rows = reportRepo.rowsFor(RUN_ID);
      expect(rows.filter((row) => row.kind === 'tod-only').map((row) => row.todIds)).toEqual([
        ['4'],
        ['5'],
      ]);
      expect(
        rows.filter((row) => row.kind === 'cams-only').map((row) => row.camsTrusteeId),
      ).toEqual([noTruIds.trusteeId, missingInTod.trusteeId]);
      expect(rows.filter((row) => row.kind === 'field')).toEqual([
        expect.objectContaining({
          camsTrusteeId: changedPhone.trusteeId,
          field: 'phone',
          camsValue: '555-010-0199',
          todValue: '555-0002',
        }),
      ]);
    });

    test('should list an unlinked trustee whose TOD status is empty as tod-only, flagged for review', async () => {
      // Unlinked mock TOD trustees are 4 and 5 (active by default) and 6 (inactive). This stub
      // makes every unlinked trustee a candidate, with 4 and 6 in scope only for an empty status.
      // 4 and 6 are on different pages, so the run must add the two pages' counts.
      vi.spyOn(ats, 'getTodOnlyCandidates').mockImplementation(async (_context, ids) =>
        ids.map((id) => ({ id, statusMissing: id === 4 || id === 6 })),
      );

      await runToCompletion(2);

      const todOnly = reportRepo.rowsFor(RUN_ID).filter((row) => row.kind === 'tod-only');
      expect(todOnly.map((row) => [row.todIds, row.todStatusMissing])).toEqual([
        [['4'], true],
        [['5'], undefined],
        [['6'], true],
      ]);
      expect((await reportRepo.readRun(RUN_ID))?.summary).toEqual(
        expect.objectContaining({ todOnly: 3, todOnlyStatusMissing: 2 }),
      );
    });

    test('should complete the run with a summary, and release the lock', async () => {
      await runToCompletion(2);

      expect(await reportRepo.readRun(RUN_ID)).toEqual(
        expect.objectContaining({
          status: 'completed',
          finishedAt: expect.any(String),
          summary: expect.objectContaining({
            trusteesCompared: 3,
            todOnly: 2,
            todOnlyStatusMissing: 0,
            camsOnly: 2,
            fieldDifferences: 1,
            fieldDifferencesByField: expect.objectContaining({ phone: 1 }),
          }),
        }),
      );
      expect(await reportRepo.readLatestCompletedRun()).toEqual(
        expect.objectContaining({ runId: RUN_ID }),
      );
      expect(lockRepo.holder()).toBeUndefined();
    });

    test('should compare a trustee linked to TOD records on different pages exactly once, against all of them', async () => {
      // Linked to TOD 2 (page 1) and 5 (page 3); its email differs from both records.
      const merged = migrated(2, { legacy: { truIds: ['2', '5'] } });
      merged.public = { ...merged.public, email: 'merged@example.com' };
      camsTrustees = [merged];
      const ids = vi.spyOn(ats, 'getTrusteesByIds');

      await runToCompletion(2);

      const fieldRows = reportRepo.rowsFor(RUN_ID).filter((row) => row.kind === 'field');
      expect(fieldRows).toEqual([
        expect.objectContaining({
          camsTrusteeId: merged.trusteeId,
          field: 'email',
          todIds: ['2', '5'],
        }),
      ]);
      expect(ids).toHaveBeenCalledWith(context, [5]);
      expect((await reportRepo.readRun(RUN_ID))?.summary?.trusteesCompared).toBe(1);
    });

    test('should replace the previously completed run and its rows', async () => {
      const previous: TrusteeDataReportRun = {
        ...queuedRun('run-old'),
        status: 'completed',
        finishedAt: '2026-11-16T10:00:00.000Z',
      };
      await reportRepo.upsertRun(previous);
      reportRepo.seedRows('run-old', [{ kind: 'tod-only', todIds: ['1'], trusteeName: 'A' }]);

      await runToCompletion(100);

      expect(await reportRepo.readRun('run-old')).toBeNull();
      expect(reportRepo.rowsFor('run-old')).toEqual([]);
    });

    test('should remove every older completed run, including one an earlier run could not remove', async () => {
      for (const [runId, finishedAt] of [
        ['run-older', '2026-11-15T10:00:00.000Z'],
        ['run-old', '2026-11-16T10:00:00.000Z'],
      ]) {
        await reportRepo.upsertRun({ ...queuedRun(runId), status: 'completed', finishedAt });
        reportRepo.seedRows(runId, [{ kind: 'tod-only', todIds: ['1'], trusteeName: 'A' }]);
      }

      await runToCompletion(100);

      expect([...reportRepo.runs.keys()]).toEqual([RUN_ID]);
      expect(reportRepo.rowsFor('run-older')).toEqual([]);
      expect(reportRepo.rowsFor('run-old')).toEqual([]);
    });

    test('should still complete and release the lock if removing the previous run fails', async () => {
      await reportRepo.upsertRun({
        ...queuedRun('run-old'),
        status: 'completed',
        finishedAt: '2026-11-16T10:00:00.000Z',
      });
      vi.spyOn(reportRepo, 'deleteRun').mockRejectedValue(new Error('boom'));

      await runToCompletion(100);

      expect((await reportRepo.readRun(RUN_ID))?.status).toBe('completed');
      expect(lockRepo.holder()).toBeUndefined();
    });

    test('should write nothing to TOD, the trustees collection or appointment collections', async () => {
      const writes = [
        'createTrustee',
        'createTrusteeHistory',
        'updateTrustee',
        'createTrusteeOversightAssignment',
        'updateTrusteeOversightAssignment',
        'setPhoneticTokens',
        'setZoomInfo',
        'deleteAll',
      ] as const;
      const writeSpies = writes.map((method) => vi.spyOn(trusteesRepo, method));
      const appointmentRepos = [
        vi.spyOn(factory, 'getTrusteeAppointmentsRepository'),
        vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository'),
      ];
      const sql = vi.spyOn(ats, 'executeQuery');

      await runToCompletion(2);

      [...writeSpies, ...appointmentRepos, sql].forEach((spy) =>
        expect(spy).not.toHaveBeenCalled(),
      );
    });
  });

  describe('error paths', () => {
    test('should still complete if releasing the lock fails, leaving it to go stale', async () => {
      vi.spyOn(lockRepo, 'delete').mockRejectedValue(new Error('boom'));

      await runToCompletion(100);

      expect((await reportRepo.readRun(RUN_ID))?.status).toBe('completed');
    });

    test('should throw at finalize when the run document is gone', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      reportRepo.runs.delete(RUN_ID);

      // Page 6 onward is empty, so this page finalizes the run.
      await expect(RunTrusteeDataReport.processPage(context, RUN_ID, 6, 100)).rejects.toThrow(
        'not found',
      );
    });

    test('should throw when the lock cannot be read', async () => {
      vi.spyOn(lockRepo, 'read').mockRejectedValue(new Error('Cosmos unavailable'));

      await expect(RunTrusteeDataReport.processPage(context, RUN_ID, null, 2)).rejects.toThrow(
        'Cosmos unavailable',
      );
    });
  });

  describe('processPage', () => {
    test('should not rewrite the run document while paging', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      const upsertSpy = vi.spyOn(reportRepo, 'upsertRun');

      expect(await RunTrusteeDataReport.processPage(context, RUN_ID, null, 2)).toEqual({
        nextCursor: 2,
      });
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('should record a retried page once, so rows and counts are not doubled', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      await RunTrusteeDataReport.processPage(context, RUN_ID, null, 2);

      await runToCompletion(2); // processes the first page again, as a throttling retry would

      const rows = reportRepo.rowsFor(RUN_ID);
      expect(rows.filter((row) => row.kind === 'field')).toHaveLength(1);
      expect(rows.filter((row) => row.kind === 'tod-only')).toHaveLength(2);
      expect((await reportRepo.readRun(RUN_ID))?.summary).toEqual(
        expect.objectContaining({
          trusteesCompared: 3,
          todOnly: 2,
          camsOnly: 2,
          fieldDifferences: 1,
        }),
      );
    });

    test('should write nothing for a page if the lock is taken over while it is read', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      const readPage = ats.getTrusteesPage.bind(ats);
      vi.spyOn(ats, 'getTrusteesPage').mockImplementationOnce(async (...args) => {
        lockRepo.docs.set('TRUSTEE_DATA_REPORT_RUN', {
          documentType: 'TRUSTEE_DATA_REPORT_RUN',
          runId: 'someone-else',
          startedAt: '2026-11-17T12:00:00.000Z',
        });
        return readPage(...args);
      });

      await expect(RunTrusteeDataReport.processPage(context, RUN_ID, null, 2)).rejects.toThrow(
        'no longer holds the run lock',
      );
      expect(reportRepo.rowsFor(RUN_ID)).toEqual([]);
    });

    test('should not complete a run whose lock is taken over while it finalizes', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      vi.spyOn(trusteesRepo, 'listTrustees').mockImplementationOnce(async () => {
        lockRepo.docs.set('TRUSTEE_DATA_REPORT_RUN', {
          documentType: 'TRUSTEE_DATA_REPORT_RUN',
          runId: 'someone-else',
          startedAt: '2026-11-17T12:00:00.000Z',
        });
        return camsTrustees;
      });

      await expect(RunTrusteeDataReport.processPage(context, RUN_ID, 6, 100)).rejects.toThrow(
        'no longer holds the run lock',
      );
      expect((await reportRepo.readRun(RUN_ID))?.status).toBe('running');
    });

    test('should throw when the run no longer holds the lock', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      lockRepo.docs.set('TRUSTEE_DATA_REPORT_RUN', {
        documentType: 'TRUSTEE_DATA_REPORT_RUN',
        runId: 'someone-else',
        startedAt: '2026-11-17T12:00:00.000Z',
      });

      await expect(RunTrusteeDataReport.processPage(context, RUN_ID, null, 2)).rejects.toThrow(
        'no longer holds the run lock',
      );
    });
  });

  describe('edge cases', () => {
    test('should complete with all-zero counts when TOD and CAMS have no trustees', async () => {
      vi.spyOn(ats, 'getTrusteesPage').mockResolvedValue([]);
      camsTrustees = [];

      await runToCompletion(100);

      expect(await reportRepo.readRun(RUN_ID)).toEqual(
        expect.objectContaining({
          status: 'completed',
          summary: expect.objectContaining({
            trusteesCompared: 0,
            todOnly: 0,
            todOnlyStatusMissing: 0,
            camsOnly: 0,
            fieldDifferences: 0,
          }),
        }),
      );
    });

    test('should report a CAMS trustee whose only TOD ID is not a number as CAMS-only, without querying TOD for it', async () => {
      const malformed = MockData.getTrustee({ legacy: { truIds: ['not-a-number'] } });
      camsTrustees = [malformed];
      const lookup = vi.spyOn(ats, 'getTrusteesByIds');

      await runToCompletion(100);

      expect(reportRepo.rowsFor(RUN_ID)).toContainEqual(
        expect.objectContaining({ kind: 'cams-only', camsTrusteeId: malformed.trusteeId }),
      );
      lookup.mock.calls.forEach(([, ids]) => expect(ids.every(Number.isInteger)).toBe(true));
    });

    test('should not query TOD for a non-numeric linked ID that is off the page, and still compare the trustee once', async () => {
      const mixed = migrated(1, { legacy: { truIds: ['1', 'not-a-number'] } });
      camsTrustees = [mixed];
      const lookup = vi.spyOn(ats, 'getTrusteesByIds');

      await runToCompletion(100);

      lookup.mock.calls.forEach(([, ids]) => expect(ids.every(Number.isInteger)).toBe(true));
      expect((await reportRepo.readRun(RUN_ID))?.summary?.trusteesCompared).toBe(1);
    });

    test('should still release the lock when failing a run whose document is gone', async () => {
      reportRepo.runs.delete(RUN_ID);

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'TOD query failed');

      expect(lockRepo.holder()).toBeUndefined();
      expect(await reportRepo.readRun(RUN_ID)).toBeNull();
    });
  });

  describe('failRun', () => {
    test('should leave a completed run and its results alone, only releasing a lock it still holds', async () => {
      await runToCompletion(100);
      const completed = await reportRepo.readRun(RUN_ID);
      const rows = reportRepo.rowsFor(RUN_ID);
      // As after a failed lock release that later went stale, or a redelivered final page.
      lockRepo.docs.set('TRUSTEE_DATA_REPORT_RUN', {
        documentType: 'TRUSTEE_DATA_REPORT_RUN',
        runId: RUN_ID,
        startedAt: '2026-11-17T10:00:00.000Z',
      });

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'redelivered page');

      expect(await reportRepo.readRun(RUN_ID)).toEqual(completed);
      expect(reportRepo.rowsFor(RUN_ID)).toEqual(rows);
      expect(lockRepo.holder()).toBeUndefined();
    });

    test('should leave an already failed run as it was', async () => {
      const failed: TrusteeDataReportRun = {
        ...queuedRun(),
        status: 'failed',
        finishedAt: '2026-11-17T11:00:00.000Z',
        failureMessage: 'first failure',
      };
      await reportRepo.upsertRun(failed);

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'second failure');

      expect(await reportRepo.readRun(RUN_ID)).toEqual(failed);
    });

    test('should never remove the run document while failing it', async () => {
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      await RunTrusteeDataReport.processPage(context, RUN_ID, null, 2);
      const deleteRun = vi.spyOn(reportRepo, 'deleteRun');

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'TOD query failed');

      expect(deleteRun).not.toHaveBeenCalled();
      expect((await reportRepo.readRun(RUN_ID))?.status).toBe('failed');
      expect(reportRepo.rowsFor(RUN_ID)).toEqual([]);
    });

    test('should mark the run failed, drop its rows, release the lock and keep the previous run', async () => {
      await reportRepo.upsertRun({
        ...queuedRun('run-old'),
        status: 'completed',
        finishedAt: '2026-11-16T10:00:00.000Z',
      });
      reportRepo.seedRows('run-old', [{ kind: 'tod-only', todIds: ['1'], trusteeName: 'A' }]);
      await RunTrusteeDataReport.startRun(context, RUN_ID);
      await RunTrusteeDataReport.processPage(context, RUN_ID, null, 2);

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'TOD query failed');

      expect(await reportRepo.readRun(RUN_ID)).toEqual(
        expect.objectContaining({
          status: 'failed',
          failureMessage: 'TOD query failed',
          finishedAt: expect.any(String),
        }),
      );
      expect(reportRepo.rowsFor(RUN_ID)).toEqual([]);
      expect(lockRepo.holder()).toBeUndefined();
      expect(await reportRepo.readLatestCompletedRun()).toEqual(
        expect.objectContaining({ runId: 'run-old' }),
      );
      expect(reportRepo.rowsFor('run-old')).toHaveLength(1);
    });

    test('should not release a lock held by a different run', async () => {
      lockRepo.docs.set('TRUSTEE_DATA_REPORT_RUN', {
        documentType: 'TRUSTEE_DATA_REPORT_RUN',
        runId: 'someone-else',
        startedAt: '2026-11-17T12:00:00.000Z',
      });

      await RunTrusteeDataReport.failRun(context, RUN_ID, 'lost the lock');

      expect(lockRepo.holder()).toBe('someone-else');
    });
  });
});
