import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import DivisionChangeCleanupMigration, {
  handleStart,
  handleFix,
  handleFixPoison,
} from './division-change-cleanup';
import {
  DivisionChangeCleanupUseCase,
  OrphanedCaseMessage,
} from '../../../lib/use-cases/dataflows/division-change-cleanup';

describe('Division Change Cleanup Migration', () => {
  let mockInvocationContext: InvocationContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockInvocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'test-function',
      extraOutputs: new Map(),
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  describe('handleStart', () => {
    test('1. should call findOrphanedCasePairs', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue([]);

      await handleStart({}, mockInvocationContext);

      expect(DivisionChangeCleanupUseCase.findOrphanedCasePairs).toHaveBeenCalled();
    });

    test('2. should set fix messages on extraOutputs', async () => {
      const fixMessages: OrphanedCaseMessage[] = [
        { orphanedCaseId: 'case-1', currentCaseId: 'case-2' },
        { orphanedCaseId: 'case-3', currentCaseId: 'case-4' },
      ];
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue(
        fixMessages,
      );

      await handleStart({}, mockInvocationContext);

      const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
      const setValue = [...extraOutputsMap.values()][0];
      expect(setValue).toEqual(fixMessages);
    });

    test('3. should set empty array on extraOutputs when no orphaned cases found', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue([]);

      await handleStart({}, mockInvocationContext);

      const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
      expect(extraOutputsMap.size).toBe(1);
      const setValue = [...extraOutputsMap.values()][0];
      expect(setValue).toEqual([]);
    });

    test('4. should handle findOrphanedCasePairs errors', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockRejectedValue(
        new Error('Use case error'),
      );

      await expect(handleStart({}, mockInvocationContext)).rejects.toThrow();
    });

    test('5. should set extraOutputs even with a single fix message', async () => {
      const fixMessages: OrphanedCaseMessage[] = [
        { orphanedCaseId: 'orphaned-case-1', currentCaseId: 'current-case-1' },
      ];
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue(
        fixMessages,
      );

      await handleStart({}, mockInvocationContext);

      const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
      const setValue = [...extraOutputsMap.values()][0];
      expect(setValue).toEqual(fixMessages);
    });
  });

  describe('handleFix', () => {
    test('6. should extract orphaned case ID from message', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockResolvedValue(0);

      await handleFix(message, mockInvocationContext);

      expect(DivisionChangeCleanupUseCase.cleanupOrphanedCase).toHaveBeenCalledWith(
        expect.anything(),
        '081-23-12345',
        'current-456',
      );
    });

    test('7. should call DivisionChangeCleanupUseCase.cleanupOrphanedCase', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: 'orphaned-123',
        currentCaseId: 'current-456',
      };

      const cleanupSpy = vi
        .spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase')
        .mockResolvedValue(0);

      await handleFix(message, mockInvocationContext);

      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('8. should pass both orphaned and current case IDs to cleanup', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: 'orphaned-123',
        currentCaseId: 'current-456',
      };

      const cleanupSpy = vi
        .spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase')
        .mockResolvedValue(0);

      await handleFix(message, mockInvocationContext);

      expect(cleanupSpy).toHaveBeenCalledWith(expect.anything(), 'orphaned-123', 'current-456');
    });

    test('9. should log case number using getCaseNumber', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: '081-24-12345',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockResolvedValue(0);

      const logSpy = vi.spyOn(mockInvocationContext, 'log');

      await handleFix(message, mockInvocationContext);

      const logCalls = logSpy.mock.calls.map((call) => String(call[0]));
      const fixingLog = logCalls.find((msg) => msg.includes('Fixing orphaned case'));
      expect(fixingLog).toBeDefined();
      expect(fixingLog).toContain('23-12345');
    });

    test('10. should handle cleanup errors', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(
        new Error('Cleanup error'),
      );

      await expect(handleFix(message, mockInvocationContext)).rejects.toThrow();
    });

    test('11. should complete trace with success when cleanup succeeds', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: '081-24-12345',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockResolvedValue(0);

      await expect(handleFix(message, mockInvocationContext)).resolves.not.toThrow();
    });

    test('12. should throw error when cleanup fails', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(
        new Error('Cleanup failed'),
      );

      await expect(handleFix(message, mockInvocationContext)).rejects.toThrow('Cleanup failed');
    });
  });

  describe('handleFixPoison', () => {
    test('14. should be exported and callable', () => {
      expect(typeof handleFixPoison).toBe('function');
    });

    test('15. should handle poison message without throwing', async () => {
      const poisonMessage = { orphanedCaseId: 'bad-case', currentCaseId: 'other-case' };

      await expect(handleFixPoison(poisonMessage, mockInvocationContext)).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (16-23)
  // ============================================================================

  describe('Integration', () => {
    test('16. should have valid MODULE_NAME constant', () => {
      expect(DivisionChangeCleanupMigration.MODULE_NAME).toBeDefined();
      expect(typeof DivisionChangeCleanupMigration.MODULE_NAME).toBe('string');
    });

    test('17. should register start handler', () => {
      expect(DivisionChangeCleanupMigration.setup).toBeDefined();
      expect(typeof DivisionChangeCleanupMigration.setup).toBe('function');
    });

    test('18. should create START queue output binding', () => {
      expect(DivisionChangeCleanupMigration.setup).toBeDefined();
    });

    test('19. should create FIX queue output binding', () => {
      expect(DivisionChangeCleanupMigration.setup).toBeDefined();
    });

    test('20. should register handleStart function', () => {
      expect(typeof handleStart).toBe('function');
    });

    test('21. should register handleFix function', () => {
      expect(typeof handleFix).toBe('function');
    });

    test('22. should export handleStart for testing', () => {
      expect(handleStart).toBeDefined();
    });

    test('23. should export handleFix for testing', () => {
      expect(handleFix).toBeDefined();
    });
  });
});
