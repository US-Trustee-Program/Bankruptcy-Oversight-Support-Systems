import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import OfficeAssigneesUseCase from '../../../lib/use-cases/offices/office-assignees';
import { CaseAssignment } from '@common/cams/assignments';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'case-assignment-event-handler',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeCaseAssignment = (overrides?: Partial<CaseAssignment & { retryCount?: number }>) => ({
  documentType: 'ASSIGNMENT' as const,
  caseId: '001-25-00001',
  userId: 'user-123',
  name: 'Test Attorney',
  role: 'TrialAttorney',
  assignedOn: '2025-01-01',
  ...overrides,
});

describe('case-assignment-event handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process event and emit success telemetry', async () => {
    const { handler } = await import('./case-assignment-event');
    const message = makeCaseAssignment();
    const invocationContext = makeInvocationContext();

    vi.spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent').mockResolvedValue(undefined);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handler(message, invocationContext);

    expect(OfficeAssigneesUseCase.handleCaseAssignmentEvent).toHaveBeenCalledWith(
      expect.anything(),
      message,
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('CASE-ASSIGNMENT-EVENT'),
      'handler',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff on 429 error', async () => {
    const { handler } = await import('./case-assignment-event');
    const message = makeCaseAssignment({ retryCount: 0 });
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('CASE-ASSIGNMENT-EVENT');
    vi.spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handler(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should emit rate-limited-requeued telemetry on 429 retry', async () => {
    const { handler } = await import('./case-assignment-event');
    const message = makeCaseAssignment({ retryCount: 0 });
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('CASE-ASSIGNMENT-EVENT');
    vi.spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handler(message, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('CASE-ASSIGNMENT-EVENT'),
      'handler',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handler } = await import('./case-assignment-event');
    const message = makeCaseAssignment({ retryCount: 10 });
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('CASE-ASSIGNMENT-EVENT');
    vi.spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handler(message, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('CASE-ASSIGNMENT-EVENT'),
      'handler',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should route to DLQ and throw on non-429 error', async () => {
    const { handler } = await import('./case-assignment-event');
    const message = makeCaseAssignment();
    const invocationContext = makeInvocationContext();

    const error = new CamsError('CASE-ASSIGNMENT-EVENT', { message: 'Database connection failed' });
    vi.spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handler(message, invocationContext)).rejects.toThrow('Database connection failed');

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });
});
