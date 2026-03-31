import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { DivisionChangeCleanupUseCase } from './division-change-cleanup';
import factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('DivisionChangeCleanupUseCase', () => {
  let context: ApplicationContext;
  const orphanedCaseId = '001-25-00001';
  const currentCaseId = '001-25-00002';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();

    // Setup default mocks for all repositories to prevent "not implemented" errors
    vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
      modifiedCount: 0,
      matchedCount: 0,
    });
    vi.spyOn(MockMongoRepository.prototype, 'getVerification').mockResolvedValue(null);
    vi.spyOn(MockMongoRepository.prototype, 'update').mockResolvedValue({} as unknown as never);
    vi.spyOn(MockMongoRepository.prototype, 'deleteMany').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'markAsMoved').mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue({
      caseId: orphanedCaseId,
      documentType: 'SYNCED_CASE',
      status: 'ACTIVE',
    } as never);
  });

  describe('cleanupOrphanedCase orchestration', () => {
    test('should return 0 and skip cleanup when case is already MOVED', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue({
        caseId: orphanedCaseId,
        documentType: 'SYNCED_CASE',
        status: 'MOVED',
      } as never);
      const markAsMovedSpy = vi.spyOn(MockMongoRepository.prototype, 'markAsMoved');

      const result = await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(result).toBe(0);
      expect(markAsMovedSpy).not.toHaveBeenCalled();
    });

    test('should return 0 and skip cleanup when case does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(null as never);
      const markAsMovedSpy = vi.spyOn(MockMongoRepository.prototype, 'markAsMoved');

      const result = await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(result).toBe(0);
      expect(markAsMovedSpy).not.toHaveBeenCalled();
    });

    // Test 1: logs start message
    test('should log start message', async () => {
      const loggerSpy = vi.spyOn(context.logger, 'info');
      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'DIVISION-CHANGE-CLEANUP-USE-CASE',
        expect.stringContaining(`Starting cleanup for ${orphanedCaseId} → ${currentCaseId}`),
      );
    });

    // Test 4: calls markAsMoved with correct params
    test('should call markAsMoved with correct params', async () => {
      const markAsMovedSpy = vi.spyOn(MockMongoRepository.prototype, 'markAsMoved');
      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );
      expect(markAsMovedSpy).toHaveBeenCalledWith(
        orphanedCaseId,
        currentCaseId,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    // Test 5: logs completion message
    test('should log completion message', async () => {
      const loggerSpy = vi.spyOn(context.logger, 'info');
      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'DIVISION-CHANGE-CLEANUP-USE-CASE',
        expect.stringContaining(`Cleanup completed for ${orphanedCaseId} → ${currentCaseId}`),
      );
    });

    // Test 7: wraps errors with getCamsError
    test('should wrap errors with getCamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
        new Error('Database error'),
      );

      const error = await getTheThrownError(() =>
        DivisionChangeCleanupUseCase.cleanupOrphanedCase(context, orphanedCaseId, currentCaseId),
      );

      expect(error.isCamsError).toBe(true);
      expect(error.message).toContain('Failed to clean up');
    });

    // Test 8: passes ISO timestamp to markAsMoved
    test('should pass ISO timestamp to markAsMoved', async () => {
      const markAsMovedSpy = vi.spyOn(MockMongoRepository.prototype, 'markAsMoved');
      const beforeCall = new Date();
      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );
      const afterCall = new Date();

      const callArgs = markAsMovedSpy.mock.calls[0];
      const timestamp = callArgs[2];
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('updateReferences', () => {
    // Test 9: updateReferences updates consolidations caseId
    test('should update consolidations caseId', async () => {
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(updateSpy).toHaveBeenCalled();
      const call = updateSpy.mock.calls[0];
      expect(call[0]).toBeDefined();
      expect(call[1]).toEqual({ $set: { caseId: currentCaseId } });
    });

    test('should call getVerification with oldCaseId for trustee-match lookup', async () => {
      const getVerificationSpy = vi
        .spyOn(MockMongoRepository.prototype, 'getVerification')
        .mockResolvedValue(null);

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(getVerificationSpy).toHaveBeenCalledWith(orphanedCaseId);
    });

    test('should update trustee-match document when getVerification returns a record', async () => {
      const trusteeMatchDoc = {
        id: 'trustee-match-doc-id',
        caseId: orphanedCaseId,
        documentType: 'TRUSTEE_MATCH_VERIFICATION',
      };
      vi.spyOn(MockMongoRepository.prototype, 'getVerification').mockResolvedValue(
        trusteeMatchDoc as unknown as never,
      );
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'update');

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(updateSpy).toHaveBeenCalledWith('trustee-match-doc-id', { caseId: currentCaseId });
    });

    test('should not call update when getVerification returns null', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getVerification').mockResolvedValue(null);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'update');

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should propagate errors from getVerification', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getVerification').mockRejectedValue(
        new Error('DB connection error'),
      );

      const error = await getTheThrownError(() =>
        DivisionChangeCleanupUseCase.cleanupOrphanedCase(context, orphanedCaseId, currentCaseId),
      );

      expect(error.isCamsError).toBe(true);
      expect(error.message).toContain('Failed to clean up');
    });
  });

  describe('moveDocuments - orders (behavioral verification)', () => {
    // Test 17: verifies order create method signature matches interface
    test('should create orders with new caseId after finding by oldCaseId', async () => {
      const oldOrder = {
        id: 'order-1',
        caseId: orphanedCaseId,
        documentType: 'ORDER',
        orderType: 'TRANSFER',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValueOnce([
        oldOrder as unknown as never,
      ]);
      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockResolvedValue({} as unknown as never);
      vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue(undefined);

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      // Verify create was called with new caseId
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: currentCaseId,
          orderType: 'TRANSFER',
          documentType: 'ORDER',
        }),
      );
      // Verify new document has no id (it's a new document)
      const createCall = createSpy.mock.calls[0][0];
      expect(createCall.id).toBeUndefined();
    });

    // Test 18: verifies old orders are deleted after creating new ones
    test('should delete old orders after creating new ones', async () => {
      const oldOrder = { id: 'order-old-id', caseId: orphanedCaseId, documentType: 'ORDER' };

      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValueOnce([
        oldOrder as unknown as never,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue({} as unknown as never);
      const deleteSpy = vi
        .spyOn(MockMongoRepository.prototype, 'delete')
        .mockResolvedValue(undefined);

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      // Verify delete was called with the old id
      expect(deleteSpy).toHaveBeenCalledWith('order-old-id');
    });
  });

  describe('moveDocuments - cases', () => {
    // Test: SYNCED_CASE documents are not moved (verify filter logic)
    test('should not process SYNCED_CASE documents in move loop', async () => {
      const syncedCase = {
        id: 'synced-case-id',
        caseId: orphanedCaseId,
        documentType: 'SYNCED_CASE',
        caseNumber: '123',
      };
      // findByCaseId is called 3 times: orders, assignments, cases
      // Return empty for orders and assignments, then return the syncedCase for cases
      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId')
        .mockResolvedValueOnce([]) // orders
        .mockResolvedValueOnce([]) // assignments
        .mockResolvedValueOnce([syncedCase]); // cases
      const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create');

      await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
        context,
        orphanedCaseId,
        currentCaseId,
      );

      // create should NOT have been called for the SYNCED_CASE document
      const createCallsForSyncedCase = createSpy.mock.calls.filter(
        (call) => call[0]?.documentType === 'SYNCED_CASE',
      );
      expect(createCallsForSyncedCase).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    test.each([
      {
        description: 'should throw on updateReferences error',
        mockSetup: () => {
          vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
            new Error('Update failed'),
          );
        },
      },
      {
        description: 'should throw on moveDocuments orders error',
        mockSetup: () => {
          vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockRejectedValue(
            new Error('Database error'),
          );
        },
      },
      {
        description: 'should throw on markAsMoved error',
        mockSetup: () => {
          vi.spyOn(MockMongoRepository.prototype, 'markAsMoved').mockRejectedValue(
            new Error('Mark failed'),
          );
        },
      },
      {
        description: 'should provide meaningful error message with originalError',
        mockSetup: () => {
          vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
            new Error('Database connection failed'),
          );
        },
      },
    ])('$description', async ({ mockSetup }) => {
      mockSetup();

      const error = await getTheThrownError(() =>
        DivisionChangeCleanupUseCase.cleanupOrphanedCase(context, orphanedCaseId, currentCaseId),
      );

      expect(error.isCamsError).toBe(true);
      expect(error.message).toContain('Failed to clean up');
      expect(error.originalError).toBeDefined();
    });
  });

  describe('findOrphanedCasePairs', () => {
    test('should return empty array when no duplicate groups exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([]);

      const result = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      expect(result).toEqual([]);
    });

    test('should return one message per orphaned case ID', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([
        { dxtrId: 'dxtr-1', courtId: 'court-1', caseIds: ['001-25-00001', '001-25-00002'] },
      ]);
      const casesGateway = factory.getCasesGateway(context);
      vi.spyOn(casesGateway, 'searchCases').mockResolvedValue([
        { caseId: '001-25-00002' },
      ] as never);

      const result = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ orphanedCaseId: '001-25-00001', currentCaseId: '001-25-00002' });
    });

    test('should return multiple messages for multiple orphaned case IDs in a group', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([
        {
          dxtrId: 'dxtr-1',
          courtId: 'court-1',
          caseIds: ['001-25-00001', '001-25-00002', '001-25-00003'],
        },
      ]);
      const casesGateway = factory.getCasesGateway(context);
      vi.spyOn(casesGateway, 'searchCases').mockResolvedValue([
        { caseId: '001-25-00002' },
      ] as never);

      const result = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { orphanedCaseId: '001-25-00001', currentCaseId: '001-25-00002' },
          { orphanedCaseId: '001-25-00003', currentCaseId: '001-25-00002' },
        ]),
      );
    });

    test('should log errors and continue when identifyOrphanedCases throws for a group', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([
        { dxtrId: 'dxtr-bad', courtId: 'court-bad', caseIds: ['001-25-99001', '001-25-99002'] },
        { dxtrId: 'dxtr-good', courtId: 'court-good', caseIds: ['001-25-00001', '001-25-00002'] },
      ]);
      const casesGateway = factory.getCasesGateway(context);
      vi.spyOn(casesGateway, 'searchCases')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ caseId: '001-25-00002' }] as never);
      const loggerErrorSpy = vi.spyOn(context.logger, 'error');

      const result = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      // Error group should be skipped and logged, good group should produce a message
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ orphanedCaseId: '001-25-00001', currentCaseId: '001-25-00002' });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'DIVISION-CHANGE-CLEANUP-USE-CASE',
        expect.stringContaining('Failed to identify orphaned cases for group'),
      );
    });

    test('should skip groups with fewer than 2 caseIds', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([
        { dxtrId: 'dxtr-1', courtId: 'court-1', caseIds: ['001-25-00001'] },
      ]);

      const result = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      expect(result).toEqual([]);
    });

    test('should log aggregation complete with correct count', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findDuplicateSyncedCases').mockResolvedValue([]);
      const loggerSpy = vi.spyOn(context.logger, 'info');

      await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);

      expect(loggerSpy).toHaveBeenCalledWith(
        'DIVISION-CHANGE-CLEANUP-USE-CASE',
        expect.stringContaining('Aggregation complete, found 0 orphaned cases for cleanup'),
      );
    });
  });
});
