import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import RotateDivisionCodePhase1UseCase from './rotate-division-code-phase-1';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { DivisionCodeRotationPhase1State } from '../gateways.types';
import QueryBuilder from '../../query/query-builder';
import { NotFoundError } from '../../common-errors/not-found-error';

const { and, using } = QueryBuilder;

type RotationDoc = { _id: string; ustDivisionCode?: string; tempCourtDivisionCode?: string };
const doc = using<RotationDoc>();

/**
 * The expected write query, built from the same public QueryBuilder API the implementation uses.
 * Asserted structurally rather than as a stringified substring: exists() and notExists() differ
 * only by rightOperand, so a substring check for the field name plus "false" passes either way
 * and cannot fail for the destination gate it is supposed to guard.
 */
const expectedWriteQuery = (ids: string[], isRename: boolean) =>
  and(
    doc('_id').contains(ids),
    doc('ustDivisionCode').exists(),
    isRename ? doc('tempCourtDivisionCode').notExists() : doc('tempCourtDivisionCode').exists(),
  );

// Distinct values on purpose. Task 1's review found tests that passed while reading the wrong
// field because both fields held the same value (see name-swap.slice-1-implementation-notes.md).
const UNIQUE_CODE = '494';
const FRESHLY_SYNCED_CODE = '495';

function makeState(
  override: Partial<DivisionCodeRotationPhase1State> = {},
): DivisionCodeRotationPhase1State {
  return {
    id: 'rotation-state-1',
    documentType: 'DIVISION_CODE_ROTATION_PHASE_1_STATE',
    currentCollection: 'cases',
    lastId: null,
    dryRun: false,
    processedCount: 0,
    renamedCount: 0,
    unsetCount: 0,
    startedAt: '2026-10-19T00:00:00.000Z',
    lastUpdatedAt: '2026-10-19T00:00:00.000Z',
    status: 'IN_PROGRESS',
    ...override,
  };
}

/** Historical document: carries the value under the old name only. */
const oldOnlyDoc = { _id: 'aaaa', caseId: '491-26-90001', ustDivisionCode: UNIQUE_CODE };

/** Both names present — D7. The value under the old name must be removed, not moved. */
const bothFieldsDoc = {
  _id: 'bbbb',
  caseId: '491-26-90002',
  ustDivisionCode: UNIQUE_CODE,
  tempCourtDivisionCode: FRESHLY_SYNCED_CODE,
};

const noUpdate = { matchedCount: 0, modifiedCount: 0 };

describe('RotateDivisionCodePhase1UseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('processRotationPage', () => {
    test('should error when no rotation has been started', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('error');
    });

    // The destination condition is the data-loss guard: $rename overwrites an existing
    // destination, so if a DXTR sync populates tempCourtDivisionCode between this page's read and
    // its write, the rename would clobber that fresh value with the stale one.
    test('should rename documents that carry only the old field name, gated on the destination', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([oldOnlyDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.renamed).toBe(1);
      expect(result.unset).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith(expectedWriteQuery([oldOnlyDoc._id], true), {
        $rename: { ustDivisionCode: 'tempCourtDivisionCode' },
      });
    });

    test('should unset the old field on documents carrying both names', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bothFieldsDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.unset).toBe(1);
      expect(result.renamed).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith(expectedWriteQuery([bothFieldsDoc._id], false), {
        $unset: { ustDivisionCode: '' },
      });
    });

    test('should issue separate writes when a page mixes both document states', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        oldOnlyDoc,
        bothFieldsDoc,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.renamed).toBe(1);
      expect(result.unset).toBe(1);
      // Mongo rejects $rename and $unset on the same path in one update document.
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    test('should write nothing in a dry run but still report what would change', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ dryRun: true }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        oldOnlyDoc,
        bothFieldsDoc,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue(noUpdate);

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.renamed).toBe(1);
      expect(result.unset).toBe(1);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should select only documents that still carry the old field name', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      const findSpy = vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );

      await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      const queryStr = JSON.stringify(findSpy.mock.calls[0][0]);
      expect(queryStr).toContain('ustDivisionCode');
      expect(queryStr).toContain('"EXISTS"');
      // Freshly-synced documents hold only tempCourtDivisionCode and must never be selected.
      expect(queryStr).toContain('true');
    });

    test('should advance to the next collection when the current one is exhausted', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ currentCollection: 'cases', lastId: 'zzzz' }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.hasMore).toBe(true);
      // The cursor must reset, or the next collection would be paged from a foreign _id.
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentCollection: 'trustee-match-verification',
          lastId: null,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should complete when the last collection is exhausted', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ currentCollection: 'trustee-match-verification' }),
      );
      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsWithUstDivisionCode',
      ).mockResolvedValue([]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.hasMore).toBe(false);
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
    });

    test('should page the verification collection through its own finder', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ currentCollection: 'trustee-match-verification', lastId: 'cursor-1' }),
      );
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findVerificationsWithUstDivisionCode')
        .mockResolvedValue([oldOnlyDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 2);

      expect(result.status).toBe('ok');
      // limit + 1 is the lookahead that decides hasMore.
      expect(findSpy).toHaveBeenCalledWith('cursor-1', 3);
    });

    // A resumed run must not restart its totals, or Task 3's verification reads low.
    test('should carry counts forward from prior pages', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ processedCount: 10, renamedCount: 7, unsetCount: 3 }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([oldOnlyDoc]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ processedCount: 11, renamedCount: 8, unsetCount: 3 }),
      );
    });

    test('should report hasMore and advance the cursor across a page boundary', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        oldOnlyDoc,
        bothFieldsDoc,
      ]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 1);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.hasMore).toBe(true);
      // Only the first document is processed; the lookahead one is left for the next page.
      expect(result.processed).toBe(1);
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ lastId: oldOnlyDoc._id }));
    });

    test('should return an error when the page read fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockRejectedValue(
        new Error('read failed'),
      );

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('error');
    });

    test('should return an error when a write fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([oldOnlyDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
        new Error('write failed'),
      );

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('error');
    });
  });

  describe('coverage for operationally significant branches', () => {
    // The real first run: no state document exists, so the repository throws NotFoundError rather
    // than resolving null. Every other test mocks a resolved null, which is not what ships.
    test('should treat a NotFoundError from the state read as no rotation started', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'not found' }),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {
        dryRun: false,
      });

      expect(result.status).toBe('started');
      expect(upsertSpy).toHaveBeenCalled();
    });

    // The documents were already mutated but the cursor was not persisted. The next page would
    // re-read the same lastId, so the job has to report this rather than claim success.
    test('should return an error when the progress write fails after a successful page', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([oldOnlyDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('state down'));

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('error');
    });

    // A matched-but-not-modified gap is the only observable evidence that the read/write race
    // actually fired. It must warn without failing the page.
    test('should warn but not fail when fewer documents were modified than matched', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(makeState());
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([oldOnlyDoc]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as DivisionCodeRotationPhase1State,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 2,
        modifiedCount: 1,
      });
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, 100);

      expect(result.status).toBe('ok');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('startRotation', () => {
    test('should default to a dry run when dryRun is not given', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {});

      expect(result.status).toBe('started');
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
          currentCollection: 'cases',
          lastId: null,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should start a real run only when dryRun is explicitly false', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      await RotateDivisionCodePhase1UseCase.startRotation(context, { dryRun: false });

      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
    });

    test('should resume an in-progress run without resetting its state', async () => {
      const existing = makeState({ lastId: 'cursor-9', processedCount: 5 });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existing);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {
        dryRun: false,
      });

      expect(result.status).toBe('started');
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    // Re-running a finished real migration is the dangerous case: the second run would re-page a
    // collection whose documents have already moved.
    test('should refuse to repeat a completed real run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ status: 'COMPLETED', dryRun: false }),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {
        dryRun: false,
      });

      expect(result.status).toBe('completed');
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('should allow a completed dry run to be superseded by a real run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        makeState({ status: 'COMPLETED', dryRun: true }),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as DivisionCodeRotationPhase1State);

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {
        dryRun: false,
      });

      expect(result.status).toBe('started');
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
    });

    test('should return an error when state cannot be read', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('boom'));

      const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {});

      expect(result.status).toBe('error');
    });
  });
});
