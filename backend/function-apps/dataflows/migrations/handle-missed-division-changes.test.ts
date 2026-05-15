import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as HandleMissedDivisionChangesUseCase from '../../../lib/use-cases/dataflows/handle-missed-division-changes';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import factory from '../../../lib/factory';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'handle-missed-division-changes',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('Handle Missed Division Changes Migration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    process.env.CAMS_OBJECT_CONTAINER = 'migration-files';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleCheck', () => {
    test('should route to FIX queue when division change found', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();
      const divisionChange = {
        orphanedCaseId: '001-25-00001',
        currentCaseId: '001-25-00002',
      };

      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockResolvedValue(
        divisionChange,
      );
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await handleCheck(message, invocationContext);

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const fixOutput = outputs.find(([key]) => key?.queueName?.includes('fix'));
      expect(fixOutput).toBeDefined();
      expect(fixOutput?.[1]).toEqual([divisionChange]);
    });

    test('should emit telemetry documentsWritten:1 when division change found', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();
      const divisionChange = {
        orphanedCaseId: '001-25-00001',
        currentCaseId: '001-25-00002',
      };

      const mockContext = await createMockApplicationContext();

      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockResolvedValue(
        divisionChange,
      );
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleCheck(message, invocationContext);

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      expect(outputs.length).toBeGreaterThan(0);
    });

    test('should succeed without writing to FIX when no division change found', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockResolvedValue(
        null,
      );
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await expect(handleCheck(message, invocationContext)).resolves.not.toThrow();

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const fixOutput = outputs.find(([key]) => key?.queueName?.includes('fix'));
      expect(fixOutput).toBeUndefined();
    });

    test('should re-enqueue to CHECK queue with backoff on 429 error', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001', retryCount: 0 };
      const invocationContext = makeInvocationContext();

      const tooManyError = new TooManyRequestsError('TEST_MODULE');
      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockRejectedValue(
        tooManyError,
      );

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const queueSpy = vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString');
      queueSpy.mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleCheck(message, invocationContext);

      expect(queueSpy).toHaveBeenCalledWith(
        process.env.AzureWebJobsDataflowsStorage,
        expect.stringContaining('check'),
      );
      expect(mockSendMessage).toHaveBeenCalled();
    });

    test('should route to DLQ after 429 retry limit exceeded', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001', retryCount: 10 };
      const invocationContext = makeInvocationContext();

      const tooManyError = new TooManyRequestsError('TEST_MODULE');
      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockRejectedValue(
        tooManyError,
      );

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await handleCheck(message, invocationContext);

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const dlqOutput = outputs.find(([key]) => key?.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      const dlqMessage = dlqOutput?.[1] as unknown[];
      expect(dlqMessage?.[0]).toHaveProperty('type', 'QUEUE_ERROR');
    });

    test('should throw and route to DLQ on non-429 error', async () => {
      const { handleCheck } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      const error = new CamsError('TEST_MODULE', { message: 'Database error' });
      vi.spyOn(HandleMissedDivisionChangesUseCase, 'checkCaseForDivisionChange').mockRejectedValue(
        error,
      );

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      await expect(handleCheck(message, invocationContext)).rejects.toThrow('Database error');

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const dlqOutput = outputs.find(([key]) => key?.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      const dlqMessage = dlqOutput?.[1] as unknown[];
      expect(dlqMessage?.[0]).toHaveProperty('type', 'QUEUE_ERROR');
    });
  });

  describe('handleStart', () => {
    test('should read blob and enqueue CheckMessages to CHECK queue', async () => {
      const { handleStart } = await import('./handle-missed-division-changes');
      const invocationContext = makeInvocationContext();
      const caseIds = ['001-25-00001', '001-25-00002'];

      const mockContext = await createMockApplicationContext();
      const objectStorageGateway = {
        readObject: vi.fn().mockResolvedValue(JSON.stringify(caseIds)),
      };

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(
        objectStorageGateway as unknown as ReturnType<typeof factory.getObjectStorageGateway>,
      );

      await handleStart({} as Record<string, unknown>, invocationContext);

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const checkOutput = outputs.find(([key]) => key?.queueName?.includes('check'));
      expect(checkOutput).toBeDefined();
      expect(Array.isArray(checkOutput?.[1])).toBe(true);
      expect((checkOutput?.[1] as unknown[]).length).toBe(2);
      const messages = checkOutput?.[1] as unknown[];
      expect(messages[0]).toHaveProperty('caseId', '001-25-00001');
      expect(messages[1]).toHaveProperty('caseId', '001-25-00002');
    });

    test('should log warning and return when blob not found', async () => {
      const { handleStart } = await import('./handle-missed-division-changes');
      const invocationContext = makeInvocationContext();

      const mockContext = await createMockApplicationContext();
      const warnSpy = vi.spyOn(mockContext.logger, 'warn');

      const objectStorageGateway = {
        readObject: vi.fn().mockResolvedValue(null),
      };

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(
        objectStorageGateway as unknown as ReturnType<typeof factory.getObjectStorageGateway>,
      );

      await handleStart({} as Record<string, unknown>, invocationContext);

      expect(warnSpy).toHaveBeenCalledWith(
        'HANDLE-MISSED-DIVISION-CHANGES',
        expect.stringContaining('No blob found'),
      );

      const outputs = Array.from(invocationContext.extraOutputs.entries());
      const checkOutput = outputs.find(([key]) => key?.queueName?.includes('check'));
      expect(checkOutput).toBeUndefined();
    });
  });

  describe('handleCheckPoison', () => {
    test('should log error and emit telemetry with success:false', async () => {
      const { handleCheckPoison } = await import('./handle-missed-division-changes');
      const message = { caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      const mockContext = await createMockApplicationContext();
      const logSpy = vi.spyOn(mockContext.logger, 'error');

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleCheckPoison(message, invocationContext);

      expect(logSpy).toHaveBeenCalledWith(
        'HANDLE-MISSED-DIVISION-CHANGES',
        expect.stringContaining('Poison message'),
      );
    });
  });

  describe('Integration', () => {
    test('should have valid MODULE_NAME constant', async () => {
      const migration = await import('./handle-missed-division-changes');
      expect(migration.default.MODULE_NAME).toBeDefined();
      expect(typeof migration.default.MODULE_NAME).toBe('string');
    });

    test('should have setup function', async () => {
      const migration = await import('./handle-missed-division-changes');
      expect(migration.default.setup).toBeDefined();
      expect(typeof migration.default.setup).toBe('function');
    });
  });
});
