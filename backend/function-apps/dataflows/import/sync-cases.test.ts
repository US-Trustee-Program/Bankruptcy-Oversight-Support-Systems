import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { handlePage } from './sync-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

describe('handlePage - division change queueing', () => {
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

  test('1. should queue division changes to FIX when detected', async () => {
    const inputEvents: CaseSyncEvent[] = [{ caseId: '081-23-12345', type: 'CASE_CHANGED' }];

    const processedEvents: CaseSyncEvent[] = [
      {
        caseId: '081-23-12345',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-12345',
          currentCaseId: '081-24-12345',
        },
      },
    ];

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
    const outputValues = [...extraOutputsMap.values()];

    // Should have 2 outputs: DLQ (empty) and FIX (with division change)
    expect(outputValues).toHaveLength(2);

    // Find the FIX output (should be the one with divisionChange messages)
    const fixOutput = outputValues.find((output) => {
      return Array.isArray(output) && output.length > 0 && output[0].orphanedCaseId !== undefined;
    });

    expect(fixOutput).toBeDefined();
    expect(fixOutput).toEqual([
      {
        orphanedCaseId: '081-23-12345',
        currentCaseId: '081-24-12345',
      },
    ]);
  });

  test('2. should not queue to FIX when no division changes detected', async () => {
    const inputEvents: CaseSyncEvent[] = [{ caseId: '081-23-12345', type: 'CASE_CHANGED' }];

    const processedEvents: CaseSyncEvent[] = [
      {
        caseId: '081-23-12345',
        type: 'CASE_CHANGED',
        // No divisionChange field
      },
    ];

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
    const outputValues = [...extraOutputsMap.values()];

    // Should have only 1 output: DLQ (empty)
    expect(outputValues).toHaveLength(1);

    // Verify no FIX output with orphanedCaseId
    const fixOutput = outputValues.find((output) => {
      return Array.isArray(output) && output.length > 0 && output[0].orphanedCaseId !== undefined;
    });

    expect(fixOutput).toBeUndefined();
  });

  test('3. should queue multiple division changes in batch', async () => {
    const inputEvents: CaseSyncEvent[] = [
      { caseId: '081-23-12345', type: 'CASE_CHANGED' },
      { caseId: '081-23-54321', type: 'CASE_CHANGED' },
      { caseId: '081-23-99999', type: 'CASE_CHANGED' },
    ];

    const processedEvents: CaseSyncEvent[] = [
      {
        caseId: '081-23-12345',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-12345',
          currentCaseId: '081-24-12345',
        },
      },
      {
        caseId: '081-23-54321',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-54321',
          currentCaseId: '081-24-54321',
        },
      },
      {
        caseId: '081-23-99999',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-99999',
          currentCaseId: '081-24-99999',
        },
      },
    ];

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
    const outputValues = [...extraOutputsMap.values()];

    // Find the FIX output
    const fixOutput = outputValues.find((output) => {
      return Array.isArray(output) && output.length > 0 && output[0].orphanedCaseId !== undefined;
    });

    expect(fixOutput).toBeDefined();
    expect(fixOutput).toHaveLength(3);
    expect(fixOutput).toEqual([
      {
        orphanedCaseId: '081-23-12345',
        currentCaseId: '081-24-12345',
      },
      {
        orphanedCaseId: '081-23-54321',
        currentCaseId: '081-24-54321',
      },
      {
        orphanedCaseId: '081-23-99999',
        currentCaseId: '081-24-99999',
      },
    ]);
  });

  test('4. should log queueing activity', async () => {
    const inputEvents: CaseSyncEvent[] = [
      { caseId: '081-23-12345', type: 'CASE_CHANGED' },
      { caseId: '081-23-54321', type: 'CASE_CHANGED' },
    ];

    const processedEvents: CaseSyncEvent[] = [
      {
        caseId: '081-23-12345',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-12345',
          currentCaseId: '081-24-12345',
        },
      },
      {
        caseId: '081-23-54321',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-54321',
          currentCaseId: '081-24-54321',
        },
      },
    ];

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    // Verify logging was called
    const logSpy = vi.spyOn(mockInvocationContext, 'log');

    // Re-run to capture log calls (since we can't capture before the call)
    vi.clearAllMocks();
    mockInvocationContext.extraOutputs = new Map();
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    // Check that log was called with the division change count
    const logCalls = logSpy.mock.calls.map((call) => String(call[0]));
    const queueLog = logCalls.find(
      (msg) => msg.includes('Queued') && msg.includes('division changes to FIX'),
    );

    expect(queueLog).toBeDefined();
    expect(queueLog).toContain('2');
  });

  test('5. should continue with DLQ processing regardless of division changes', async () => {
    const inputEvents: CaseSyncEvent[] = [
      { caseId: '081-23-12345', type: 'CASE_CHANGED' },
      { caseId: '081-23-54321', type: 'CASE_CHANGED' },
      { caseId: '081-23-99999', type: 'CASE_CHANGED' },
    ];

    const processedEvents: CaseSyncEvent[] = [
      {
        caseId: '081-23-12345',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-12345',
          currentCaseId: '081-24-12345',
        },
      },
      {
        caseId: '081-23-54321',
        type: 'CASE_CHANGED',
        error: new Error('Failed to sync'),
      },
      {
        caseId: '081-23-99999',
        type: 'CASE_CHANGED',
        divisionChange: {
          orphanedCaseId: '081-23-99999',
          currentCaseId: '081-24-99999',
        },
      },
    ];

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue(processedEvents);

    await handlePage(inputEvents, mockInvocationContext);

    const extraOutputsMap = mockInvocationContext.extraOutputs as Map<unknown, unknown>;
    const outputValues = [...extraOutputsMap.values()];

    // Should have 2 outputs: DLQ and FIX
    expect(outputValues).toHaveLength(2);

    // Find the FIX output
    const fixOutput = outputValues.find((output) => {
      return Array.isArray(output) && output.length > 0 && output[0].orphanedCaseId !== undefined;
    });

    expect(fixOutput).toBeDefined();
    expect(fixOutput).toHaveLength(2); // Two division changes

    // Find the DLQ output
    const dlqOutput = outputValues.find((output) => {
      return Array.isArray(output) && output.length > 0 && output[0].error !== undefined;
    });

    expect(dlqOutput).toBeDefined();
    expect(dlqOutput).toHaveLength(1); // One error
    expect(dlqOutput[0].caseId).toBe('081-23-54321');
  });
});
