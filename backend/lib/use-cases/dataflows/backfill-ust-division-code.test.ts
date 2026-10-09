import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillUstDivisionCodeUseCase from './backfill-ust-division-code';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UstDivisionCodeBackfillState } from '../gateways.types';

describe('BackfillUstDivisionCodeUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  describe('backfillUstDivisionCodes', () => {
    test('should write ustDivisionCode for a Winchester case found in DXTR', async () => {
      const bCase = { _id: 'case-id-1', caseId: '491-25-12345' };
      const dxtrMap = new Map([[bCase.caseId, '494']]);

      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        dxtrMap,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        bCase,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $set: { ustDivisionCode: '494' } }),
      );
    });

    test('should skip and log when DXTR has no CS_DIV match for a case', async () => {
      const bCase = { _id: 'case-id-1', caseId: '491-25-12345' };

      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        new Map(),
      );
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery');

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        bCase,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should record failure when updateManyByQuery throws', async () => {
      const bCase = { _id: 'case-id-1', caseId: '491-25-12345' };

      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        new Map([[bCase.caseId, '494']]),
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [
        bCase,
      ]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Write failed');
    });
  });

  describe('readBackfillState', () => {
    test('should return existing state', async () => {
      const existingState: UstDivisionCodeBackfillState = {
        id: 'state-id-1',
        documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'cursor-abc',
        processedCount: 42,
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
      const case1 = { _id: 'aaaa', caseId: '491-25-00001' };
      const case2 = { _id: 'bbbb', caseId: '491-25-00002' };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([case1, case2]);
      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        new Map([[case1.caseId, '494']]),
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        modifiedCount: 1,
        matchedCount: 1,
      });
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 1);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toEqual({ lastId: 'aaaa' });
      expect(result.successCount).toBe(1);
    });

    test('should return ok with null nextCursor on last page', async () => {
      const bCase = { _id: 'cccc', caseId: '491-25-00003' };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        new Map([[bCase.caseId, '494']]),
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        modifiedCount: 1,
        matchedCount: 1,
      });
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(
        {} as UstDivisionCodeBackfillState,
      );

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toBeNull();
    });

    test('should return error when state read fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('DB error'));

      const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('error');
    });

    test('should return ok with failedResults when some cases fail to update', async () => {
      const bCase = { _id: 'dddd', caseId: '491-25-00004' };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([bCase]);
      vi.spyOn(CasesLocalGateway.prototype, 'getUstDivisionCodesByCaseIds').mockResolvedValue(
        new Map([[bCase.caseId, '494']]),
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
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
  });
});
