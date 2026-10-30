import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'resync-remaining-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('resync-remaining-cases handleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('routes a transient error to DLQ instead of throwing, preserving the manual retryCount', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(
      new TooManyRequestsError('TEST'),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
    const [dlqEvent] = dlqOutput?.[1] as CaseSyncEvent[];
    expect(dlqEvent.error).toBeDefined();
    expect(dlqEvent.retryCount).toBe(1);
  });

  test('re-throws a non-transient error', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow('boom');
  });
});
