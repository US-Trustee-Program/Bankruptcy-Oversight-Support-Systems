import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import MigrateOfficeAssigneesUseCase from '../../../lib/use-cases/dataflows/migrate-office-assignees';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'migrate-assignees-start',
    extraOutputs: {
      set: vi.fn(),
      get: vi.fn(),
    },
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('migrate-assignees start', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should complete trace with success:true on successful migration', async () => {
    const { start } = await import('./migrate-assignees');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(MigrateOfficeAssigneesUseCase, 'migrateAssignments').mockResolvedValue({
      success: 5,
      fail: 0,
    });

    const traceSpy = vi
      .spyOn(DataflowTelemetry, 'completeDataflowTrace')
      .mockResolvedValue(undefined);

    await start({} as never, invocationContext);

    expect(traceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-ASSIGNEES',
      'start',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
  });

  test('should rethrow 429 error without calling failure trace', async () => {
    const { start } = await import('./migrate-assignees');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const rateLimitError = new TooManyRequestsError('MIGRATE-ASSIGNEES');
    vi.spyOn(MigrateOfficeAssigneesUseCase, 'migrateAssignments').mockRejectedValue(rateLimitError);

    const traceSpy = vi
      .spyOn(DataflowTelemetry, 'completeDataflowTrace')
      .mockResolvedValue(undefined);

    await expect(start({} as never, invocationContext)).rejects.toThrow(rateLimitError);

    expect(traceSpy).not.toHaveBeenCalled();
  });

  test('should call failure trace and rethrow on non-429 error', async () => {
    const { start } = await import('./migrate-assignees');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const dbError = new CamsError('MIGRATE-ASSIGNEES', { message: 'Database write failed' });
    vi.spyOn(MigrateOfficeAssigneesUseCase, 'migrateAssignments').mockRejectedValue(dbError);

    const traceSpy = vi
      .spyOn(DataflowTelemetry, 'completeDataflowTrace')
      .mockResolvedValue(undefined);

    await expect(start({} as never, invocationContext)).rejects.toThrow();

    expect(traceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-ASSIGNEES',
      'start',
      expect.anything(),
      expect.objectContaining({ success: false }),
    );
  });
});
