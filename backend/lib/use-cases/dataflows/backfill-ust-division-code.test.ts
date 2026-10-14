import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillUstDivisionCodeUseCase from './backfill-ust-division-code';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { UstDivisionCodeBackfillState } from '../gateways.types';

const winchesterCase = {
  _id: 'aaaa',
  caseId: '491-25-00001',
  courtDivisionCode: '491',
  courtDivisionName: 'Winchester',
};
const chattanoogaCase = {
  _id: 'bbbb',
  caseId: '491-25-00002',
  courtDivisionCode: '491',
  courtDivisionName: 'Chattanooga',
};
const unresolvedCase = {
  _id: 'cccc',
  caseId: '491-25-00003',
  courtDivisionCode: '491',
  courtDivisionName: 'Cleveland',
};

describe('BackfillUstDivisionCodeUseCase', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  describe('getPageOfCasesNeedingBackfillByCursor', () => {
    test('should return a page of cases needing backfill', async () => {
      const mockCase = { _id: 'case-id-1', caseId: '491-25-12345' };

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([mockCase]);

      const result = await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.cases).toEqual([mockCase]);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe('case-id-1');
    });

    test('should detect hasMore when results exceed limit', async () => {
      const case1 = { _id: 'case-id-1', caseId: '491-25-00001' };
      const case2 = { _id: 'case-id-2', caseId: '491-25-00002' };

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([case1, case2]);

      const result = await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        1,
      );

      expect(result.data?.cases).toEqual([case1]);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('case-id-1');
    });

    test('should return empty result when no cases found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);

      const result = await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.cases.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('scopes the query to unmoved SYNCED_CASE docs in court 0649 missing ustDivisionCode', async () => {
      const findByCursorSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findByCursor')
        .mockResolvedValue([]);

      await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        100,
      );

      expect(findByCursorSpy).toHaveBeenCalledTimes(1);
      const [query, options] = findByCursorSpy.mock.calls[0];
      expect(query).toEqual({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'SYNCED_CASE',
          },
          { condition: 'EQUALS', leftOperand: { name: 'courtId' }, rightOperand: '0649' },
          { condition: 'EXISTS', leftOperand: { name: 'ustDivisionCode' }, rightOperand: false },
          { condition: 'EXISTS', leftOperand: { name: 'movedToCaseId' }, rightOperand: false },
        ],
      });
      expect(options).toEqual({ limit: 101, sortField: '_id', sortDirection: 'ASCENDING' });
    });

    test('adds a cursor condition only when lastId is provided', async () => {
      const findByCursorSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findByCursor')
        .mockResolvedValue([]);

      await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        'cursor-abc',
        100,
      );

      const [query] = findByCursorSpy.mock.calls[0];
      expect(query).toMatchObject({
        values: expect.arrayContaining([
          { condition: 'GREATER_THAN', leftOperand: { name: '_id' }, rightOperand: 'cursor-abc' },
        ]),
      });
    });

    test('should return error when repo call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillUstDivisionCodeUseCase.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('resolveUstDivisionCode', () => {
    test.each([
      { courtDivisionCode: '491', courtDivisionName: 'Winchester', expected: '494' },
      { courtDivisionCode: '492', courtDivisionName: 'Johnson City', expected: '495' },
      { courtDivisionCode: '491', courtDivisionName: 'Chattanooga', expected: '491' },
      { courtDivisionCode: '492', courtDivisionName: 'Greeneville', expected: '492' },
      // Knoxville's ACMS code is unshared, so it falls through the map untouched.
      { courtDivisionCode: '493', courtDivisionName: 'Knoxville', expected: '493' },
      { courtDivisionCode: '491', courtDivisionName: ' Winchester ', expected: '494' },
    ])(
      'should resolve $courtDivisionCode/$courtDivisionName to $expected',
      ({ courtDivisionCode, courtDivisionName, expected }) => {
        expect(
          BackfillUstDivisionCodeUseCase.resolveUstDivisionCode(
            courtDivisionCode,
            courtDivisionName,
          ),
        ).toBe(expected);
      },
    );

    test.each([
      { courtDivisionCode: '491', courtDivisionName: 'Cleveland' },
      { courtDivisionCode: '492', courtDivisionName: undefined },
    ])(
      'should not resolve a shared ACMS code $courtDivisionCode with unrecognized name $courtDivisionName',
      ({ courtDivisionCode, courtDivisionName }) => {
        expect(
          BackfillUstDivisionCodeUseCase.resolveUstDivisionCode(
            courtDivisionCode,
            courtDivisionName,
          ),
        ).toBeUndefined();
      },
    );
  });

  describe('backfillUstDivisionCodes', () => {
    test('should write the resolved ustDivisionCode to exactly the paged document', async () => {
      const setSpy = vi
        .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
        .mockResolvedValue();

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        winchesterCase,
      ]);

      expect(result.escaped).toBe(false);
      expect(result.results).toEqual([{ caseId: winchesterCase.caseId, success: true }]);
      expect(setSpy).toHaveBeenCalledWith(winchesterCase._id, winchesterCase.caseId, '494');
    });

    test('should write courtDivisionCode when the division is not shared', async () => {
      const setSpy = vi
        .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
        .mockResolvedValue();

      await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [chattanoogaCase]);

      expect(setSpy).toHaveBeenCalledWith(chattanoogaCase._id, chattanoogaCase.caseId, '491');
    });

    test('should skip without writing when the division name does not resolve', async () => {
      const setSpy = vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode');

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        unresolvedCase,
      ]);

      expect(result.results).toEqual([
        { caseId: unresolvedCase.caseId, success: true, skipped: true },
      ]);
      expect(setSpy).not.toHaveBeenCalled();
    });

    describe('per-document throttling backoff', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      test('should back off and retry the same document when the write is throttled', async () => {
        const setSpy = vi
          .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
          .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
          .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
          .mockResolvedValue();

        const resultPromise = BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(
          context,
          [winchesterCase],
          { safeThresholdMs: 58 * 60 * 1000, baseDelayMs: 100 },
        );
        await vi.advanceTimersByTimeAsync(199);
        expect(setSpy).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(setSpy).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(400);
        const result = await resultPromise;

        expect(setSpy).toHaveBeenCalledTimes(3);
        expect(setSpy).toHaveBeenNthCalledWith(3, winchesterCase._id, winchesterCase.caseId, '494');
        expect(result.results).toEqual([{ caseId: winchesterCase.caseId, success: true }]);
      });

      test('should stop before the safe threshold and leave the rest of the page unprocessed', async () => {
        const setSpy = vi
          .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
          .mockResolvedValueOnce()
          .mockRejectedValue(new TooManyRequestsError('TEST'));

        // elapsed (100ms) + first backoff (2^1 * 100 = 200ms) exceeds safeThresholdMs (150ms)
        const resultPromise = BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(
          context,
          [winchesterCase, chattanoogaCase, unresolvedCase],
          { startedAt: Date.now() - 100, safeThresholdMs: 150, baseDelayMs: 100 },
        );
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.escaped).toBe(true);
        expect(result.results).toEqual([{ caseId: winchesterCase.caseId, success: true }]);
        expect(setSpy).toHaveBeenCalledTimes(2);
      });
    });

    test('should record failure when the write throws a non-throttling error', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode').mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        winchesterCase,
      ]);

      expect(result.results).toEqual([
        { caseId: winchesterCase.caseId, success: false, error: 'Write failed' },
      ]);
    });
  });

  describe('readBackfillState', () => {
    test('should return existing state', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'state-id-1',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'cursor-abc',
        processedCount: 42,
        skippedCount: 0,
        failedCount: 0,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T01:00:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const result = await BackfillUstDivisionCodeUseCase.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data?.lastId).toBe('cursor-abc');
      expect(result.data?.processedCount).toBe(42);
    });

    test('should return null on first run (NotFoundError)', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const result = await BackfillUstDivisionCodeUseCase.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    test('should return error on unexpected failure', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new Error('Connection lost'),
      );

      const result = await BackfillUstDivisionCodeUseCase.readBackfillState(context);

      expect(result.error).toBeDefined();
    });
  });

  describe('processBackfillPage', () => {
    test('should resume after the last processed case when the batch escapes on throttling', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
        vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
          winchesterCase,
          chattanoogaCase,
        ]);
        vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
          .mockResolvedValueOnce()
          .mockRejectedValue(new TooManyRequestsError('TEST'));
        const upsertSpy = vi
          .spyOn(MockMongoRepository.prototype, 'upsert')
          .mockResolvedValue({} as UstDivisionCodeBackfillState);

        const resultPromise = BackfillUstDivisionCodeUseCase.processBackfillPage(
          context,
          'cursor-start',
          100,
          { startedAt: Date.now() - 100, safeThresholdMs: 150, baseDelayMs: 100 },
        );
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.nextCursor).toEqual({ lastId: winchesterCase._id });
        expect(result.successCount).toBe(1);
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            lastId: winchesterCase._id,
            processedCount: 1,
            status: 'IN_PROGRESS',
          }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    test('should return empty when no cases need backfill', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('empty');
    });

    test('should return ok with nextCursor when hasMore', async () => {
      const case1 = winchesterCase;
      const case2 = chattanoogaCase;

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([case1, case2]);
      const setSpy = vi
        .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 1);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toEqual({ lastId: 'aaaa' });
      expect(result.successCount).toBe(1);
      expect(setSpy).toHaveBeenCalledWith(case1._id, case1.caseId, '494');
    });

    test('should accumulate processedCount from prior state and keep IN_PROGRESS while more pages remain', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'state-id-1',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'cursor-prev',
        processedCount: 5,
        skippedCount: 0,
        failedCount: 0,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      // Return 2 cases with limit 1 so hasMore is true.
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        winchesterCase,
        chattanoogaCase,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode').mockResolvedValue();
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(
        context,
        'cursor-prev',
        1,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      // 5 (prior) + 1 (winchester written this page) = 6
      expect(result.processedCount).toBe(6);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processedCount: 6,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should return ok with null nextCursor on last page', async () => {
      const bCase = winchesterCase;

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      const setSpy = vi
        .spyOn(MockMongoRepository.prototype, 'setUstDivisionCode')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toBeNull();
      expect(setSpy).toHaveBeenCalledWith(bCase._id, bCase.caseId, '494');
    });

    test('should return error when state read fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('DB error'));

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('error');
    });

    test('should track unresolved-division skips separately from successes and mark COMPLETED_WITH_SKIPS', async () => {
      const bCase = unresolvedCase;

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.processedCount).toBe(1);
      expect(result.failedResults).toHaveLength(0);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED_WITH_SKIPS', skippedCount: 1 }),
      );
    });

    test('should accumulate skippedCount across pages and preserve COMPLETED_WITH_SKIPS on the empty final page', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'state-id-skips',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'cursor-xyz',
        processedCount: 3,
        skippedCount: 2,
        failedCount: 0,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(
        context,
        'cursor-xyz',
        100,
      );

      expect(result.status).toBe('empty');
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED_WITH_SKIPS', skippedCount: 2 }),
      );
    });

    test('should return ok with failedResults when some cases fail to update', async () => {
      const bCase = winchesterCase;

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode').mockRejectedValue(
        new Error('Write failed'),
      );
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.failedResults).toHaveLength(1);
      expect(result.failedResults[0].caseId).toBe(bCase.caseId);
      expect(result.successCount).toBe(0);
    });

    test('should mark the final page COMPLETED_WITH_FAILURES rather than COMPLETED when a write fails', async () => {
      const bCase = winchesterCase;

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode').mockRejectedValue(
        new Error('Write failed'),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED_WITH_FAILURES', failedCount: 1 }),
      );
    });

    // The empty-page branch reads the prior counts straight off existing state, so the
    // COMPLETED_WITH_SKIPS test above never exercises the accumulation on a page that actually
    // did work. Without this, dropping either `currentSkippedCount +` or `currentFailedCount +`
    // leaves the suite green: a resumed run whose earlier pages skipped or failed, followed by a
    // clean final page, would lose those counts and report COMPLETED.
    test('should carry processed, skipped and failed counts from prior state onto a non-empty final page', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'state-id-carryover',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'cursor-prior',
        processedCount: 10,
        skippedCount: 4,
        failedCount: 2,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      // One of each outcome on the last page: winchester writes, chattanooga fails,
      // unresolvedCase ('Cleveland') has no entry under shared ACMS 491 so it skips.
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        winchesterCase,
        chattanoogaCase,
        unresolvedCase,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'setUstDivisionCode').mockImplementation(
        async (_id: string, caseId: string) => {
          if (caseId === chattanoogaCase.caseId) throw new Error('Write failed');
        },
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(
        context,
        'cursor-prior',
        100,
      );

      expect(result.status).toBe('ok');
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processedCount: 12, // 10 prior + 1 written + 1 skipped
          skippedCount: 5, // 4 prior + 1
          failedCount: 3, // 2 prior + 1
          status: 'COMPLETED_WITH_FAILURES',
        }),
      );
    });
  });

  describe('updateBackfillState', () => {
    test('should create new state on first run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      await BackfillUstDivisionCodeUseCase.updateBackfillState(context, {
        lastId: 'cursor-xyz',
        processedCount: 10,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
          lastId: 'cursor-xyz',
          processedCount: 10,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should preserve startedAt when updating existing state', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'existing-id',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'old-cursor',
        processedCount: 5,
        skippedCount: 0,
        failedCount: 0,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as UstDivisionCodeBackfillState);

      await BackfillUstDivisionCodeUseCase.updateBackfillState(context, {
        lastId: 'new-cursor',
        processedCount: 15,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-id',
          startedAt: '2026-01-01T00:00:00.000Z',
          lastId: 'new-cursor',
          processedCount: 15,
        }),
      );
    });

    test('should return error when upsert fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('DB error'));

      const result = await BackfillUstDivisionCodeUseCase.updateBackfillState(context, {
        lastId: null,
        processedCount: 0,
        status: 'FAILED',
      });

      expect(result.error).toBeDefined();
    });

    test('should return error when the internal state read fails with a non-NotFoundError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new Error('Connection lost'),
      );
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');

      const result = await BackfillUstDivisionCodeUseCase.updateBackfillState(context, {
        lastId: null,
        processedCount: 0,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeDefined();
      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });
});
