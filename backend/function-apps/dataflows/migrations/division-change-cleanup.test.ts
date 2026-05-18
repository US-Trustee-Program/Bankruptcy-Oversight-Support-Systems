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
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('Division Change Cleanup Migration', () => {
  let mockInvocationContext: InvocationContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    mockInvocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'test-function',
      extraOutputs: new Map(),
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  describe('handleStart', () => {
    test('should call findOrphanedCasePairs', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue([]);

      await handleStart({}, mockInvocationContext);

      expect(DivisionChangeCleanupUseCase.findOrphanedCasePairs).toHaveBeenCalled();
    });

    test('should set fix messages on extraOutputs', async () => {
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

    test('should set empty array on extraOutputs when no orphaned cases found', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockResolvedValue([]);

      await handleStart({}, mockInvocationContext);

      const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
      expect(extraOutputsMap.size).toBe(1);
      const setValue = [...extraOutputsMap.values()][0];
      expect(setValue).toEqual([]);
    });

    test('should handle findOrphanedCasePairs errors', async () => {
      vi.spyOn(DivisionChangeCleanupUseCase, 'findOrphanedCasePairs').mockRejectedValue(
        new Error('Use case error'),
      );

      await expect(handleStart({}, mockInvocationContext)).rejects.toThrow();
    });

    test('should set extraOutputs even with a single fix message', async () => {
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
    test('should pass both orphaned and current case IDs to cleanup', async () => {
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

    test('should log case number using getCaseNumber', async () => {
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

    test('should handle cleanup errors', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(
        new Error('Cleanup error'),
      );

      await expect(handleFix(message, mockInvocationContext)).rejects.toThrow();
    });

    test('should throw error when cleanup fails', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(
        new Error('Cleanup failed'),
      );

      await expect(handleFix(message, mockInvocationContext)).rejects.toThrow('Cleanup failed');
    });

    test('should re-enqueue with backoff on 429 error', async () => {
      const message = { orphanedCaseId: '081-23-12345', currentCaseId: 'current-456' };
      const tooManyError = new TooManyRequestsError('DIVISION-CHANGE-CLEANUP-MIGRATION');

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(tooManyError);
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleFix(message, mockInvocationContext);

      expect(mockSendMessage).toHaveBeenCalled();
    });

    test('should route to DLQ when retry limit exhausted on 429', async () => {
      const message = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
        retryCount: 10,
      };
      const tooManyError = new TooManyRequestsError('DIVISION-CHANGE-CLEANUP-MIGRATION');

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(tooManyError);
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await handleFix(message, mockInvocationContext);

      const outputs = Array.from(
        (
          mockInvocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
    });

    test('should throw and route to DLQ on non-429 error', async () => {
      const message: OrphanedCaseMessage = {
        orphanedCaseId: '081-23-12345',
        currentCaseId: 'current-456',
      };
      const genericError = new CamsError('DIVISION-CHANGE-CLEANUP-MIGRATION', {
        message: 'Database connection failed',
      });

      vi.spyOn(DivisionChangeCleanupUseCase, 'cleanupOrphanedCase').mockRejectedValue(genericError);
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await expect(handleFix(message, mockInvocationContext)).rejects.toThrow(
        'Database connection failed',
      );

      const outputs = Array.from(
        (
          mockInvocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
    });
  });

  describe('handleFixPoison', () => {
    test('should handle poison message without throwing', async () => {
      const poisonMessage = { orphanedCaseId: 'bad-case', currentCaseId: 'other-case' };

      await expect(handleFixPoison(poisonMessage, mockInvocationContext)).resolves.not.toThrow();
    });
  });

  describe('Integration', () => {
    test('should have valid MODULE_NAME constant', () => {
      expect(DivisionChangeCleanupMigration.MODULE_NAME).toBeDefined();
      expect(typeof DivisionChangeCleanupMigration.MODULE_NAME).toBe('string');
    });

    test('should register start handler', () => {
      expect(DivisionChangeCleanupMigration.setup).toBeDefined();
      expect(typeof DivisionChangeCleanupMigration.setup).toBe('function');
    });

    test('should register handleStart function', () => {
      expect(typeof handleStart).toBe('function');
    });

    test('should register handleFix function', () => {
      expect(typeof handleFix).toBe('function');
    });
  });
});
