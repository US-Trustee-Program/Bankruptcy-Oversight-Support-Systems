import { describe, test, beforeEach, vi, expect } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import * as handler from './detect-deleted-cases';
import DetectDeletedCases, {
  CaseDeletedEvent,
} from '../../../lib/use-cases/dataflows/detect-deleted-cases';
import ContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CASE_DELETED_EVENT_QUEUE } from '../../../lib/storage-queues';
import * as telemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';

describe('detect-deleted-cases timer trigger', () => {
  let invocationContext: Partial<InvocationContext>;
  let timerInfo: Timer;

  beforeEach(() => {
    vi.restoreAllMocks();
    invocationContext = {
      invocationId: 'test-invocation-id',
      extraOutputs: new Map(),
    };
    timerInfo = {} as Timer; // Timer info not used in handler
  });

  test('should call DetectDeletedCases.getDeletedCaseEvents', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const getDeletedCaseEventsSpy = vi
      .spyOn(DetectDeletedCases, 'getDeletedCaseEvents')
      .mockResolvedValue([]);

    await handler.timerTrigger(timerInfo, invocationContext as InvocationContext);

    expect(getDeletedCaseEventsSpy).toHaveBeenCalledWith(mockContext);
  });

  test('should queue each event to case-deleted-event queue', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const events: CaseDeletedEvent[] = [
      { type: 'CASE_DELETED', caseId: '001-25-00001', deletedDate: '2025-02-11' },
      { type: 'CASE_DELETED', caseId: '002-25-00002', deletedDate: '2025-02-11' },
    ];
    vi.spyOn(DetectDeletedCases, 'getDeletedCaseEvents').mockResolvedValue(events);

    await handler.timerTrigger(timerInfo, invocationContext as InvocationContext);

    expect(invocationContext.extraOutputs.get(CASE_DELETED_EVENT_QUEUE)).toEqual(events);
  });

  test('should handle empty results (no deleted cases)', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    vi.spyOn(DetectDeletedCases, 'getDeletedCaseEvents').mockResolvedValue([]);

    await handler.timerTrigger(timerInfo, invocationContext as InvocationContext);

    expect(invocationContext.extraOutputs.get(CASE_DELETED_EVENT_QUEUE)).toEqual([]);
  });

  test('should handle errors from use case', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const testError = new Error('Test error from use case');
    vi.spyOn(DetectDeletedCases, 'getDeletedCaseEvents').mockRejectedValue(testError);

    await expect(
      handler.timerTrigger(timerInfo, invocationContext as InvocationContext),
    ).rejects.toThrow('Test error from use case');
  });

  test('should log start and completion', async () => {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const events: CaseDeletedEvent[] = [
      { type: 'CASE_DELETED', caseId: '001-25-00001', deletedDate: '2025-02-11' },
    ];
    vi.spyOn(DetectDeletedCases, 'getDeletedCaseEvents').mockResolvedValue(events);

    const completeDataflowTraceSpy = vi.spyOn(telemetry, 'completeDataflowTrace');

    await handler.timerTrigger(timerInfo, invocationContext as InvocationContext);

    expect(completeDataflowTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'DETECT-DELETED-CASES',
      'timerTrigger',
      expect.anything(),
      expect.objectContaining({
        success: true,
      }),
    );
  });
});
