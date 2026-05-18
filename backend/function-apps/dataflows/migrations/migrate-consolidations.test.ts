import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { handlePage, handleStart } from './migrate-consolidations';
import { AcmsEtlQueueItem } from '../../../lib/use-cases/dataflows/migrate-consolidations';

const makeInvocationContext = (): InvocationContext => {
  const extraOutputsMap = new Map();
  return {
    invocationId: 'test-invocation-id',
    functionName: 'migrate-consolidations-handlePage',
    extraOutputs: {
      set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
      get: vi.fn((key) => extraOutputsMap.get(key)),
    },
    log: vi.fn(),
    _extraOutputsMap: extraOutputsMap,
  } as unknown as InvocationContext;
};

const makeEtlItem = (leadCaseId: string): AcmsEtlQueueItem => ({
  divisionCode: '081',
  chapter: '7',
  leadCaseId,
});

describe('migrate-consolidations handlePage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockResolvedValue(undefined);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
  });

  test('should process all items and complete trace on success', async () => {
    const invocationContext = makeInvocationContext();
    const page = [makeEtlItem('12345'), makeEtlItem('67890')];

    vi.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockResolvedValue({
      leadCaseId: '12345',
      memberCaseCount: 1,
      success: true,
    });

    await handlePage(page, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CONSOLIDATIONS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
  });

  test('should complete trace with success:false and return gracefully on 429 error (no throw)', async () => {
    const invocationContext = makeInvocationContext();
    const page = [makeEtlItem('12345')];

    const rateLimitError = new TooManyRequestsError('MIGRATE-CONSOLIDATIONS', {
      message: 'Rate limited',
    });
    vi.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockResolvedValue({
      leadCaseId: '12345',
      memberCaseCount: 0,
      success: false,
      error: rateLimitError,
    });

    await expect(handlePage(page, invocationContext)).resolves.toBeUndefined();

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CONSOLIDATIONS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited' }),
    );
  });

  test('should not send to hard-stop queue on 429 graceful skip', async () => {
    const invocationContext = makeInvocationContext();
    const page = [makeEtlItem('12345')];

    const rateLimitError = new TooManyRequestsError('MIGRATE-CONSOLIDATIONS', {
      message: 'Rate limited',
    });
    vi.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockResolvedValue({
      leadCaseId: '12345',
      memberCaseCount: 0,
      success: false,
      error: rateLimitError,
    });

    await handlePage(page, invocationContext);

    const setMock = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    const hardStopCalls = setMock.mock.calls.filter(([key]) =>
      key?.queueName?.includes('hard-stop'),
    );
    expect(hardStopCalls).toHaveLength(0);
  });

  test('should route to hard-stop and not throw on non-429 error', async () => {
    const invocationContext = makeInvocationContext();
    const page = [makeEtlItem('12345')];

    const genericError = new UnknownError('MIGRATE-CONSOLIDATIONS', { message: 'DB error' });
    vi.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockResolvedValue({
      leadCaseId: '12345',
      memberCaseCount: 0,
      success: false,
      error: genericError,
    });

    await expect(handlePage(page, invocationContext)).resolves.toBeUndefined();

    const setMock = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    const hardStopCalls = setMock.mock.calls.filter(([key]) =>
      key?.queueName?.includes('hard-stop'),
    );
    expect(hardStopCalls).toHaveLength(1);
  });
});

describe('migrate-consolidations handleStart', () => {
  test('should be exported', () => {
    expect(handleStart).toBeDefined();
    expect(typeof handleStart).toBe('function');
  });
});
