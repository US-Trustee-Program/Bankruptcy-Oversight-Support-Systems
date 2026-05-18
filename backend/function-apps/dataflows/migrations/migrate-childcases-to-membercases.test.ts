import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import Factory from '../../../lib/factory';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'migrate-childcases-to-membercases-start',
    extraOutputs: {
      set: vi.fn(),
      get: vi.fn(),
    },
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('migrate-childcases-to-membercases start', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should complete trace with success:true on successful migration', async () => {
    const { start } = await import('./migrate-childcases-to-membercases');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const mockConsolidationsRepo = {
      updateManyByQuery: vi.fn().mockResolvedValue({ matchedCount: 2, modifiedCount: 2 }),
    };
    const mockCasesRepo = {
      getAllCaseHistory: vi.fn().mockResolvedValue([]),
      updateCaseHistory: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(Factory, 'getConsolidationOrdersRepository').mockReturnValue(
      mockConsolidationsRepo as unknown as ReturnType<
        typeof Factory.getConsolidationOrdersRepository
      >,
    );
    vi.spyOn(Factory, 'getCasesRepository').mockReturnValue(
      mockCasesRepo as unknown as ReturnType<typeof Factory.getCasesRepository>,
    );

    const traceSpy = vi
      .spyOn(DataflowTelemetry, 'completeDataflowTrace')
      .mockResolvedValue(undefined);

    await start({} as never, invocationContext);

    expect(traceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CHILDCASES-TO-MEMBERCASES',
      'start',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );

    const extraOutputsSet = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    expect(extraOutputsSet).not.toHaveBeenCalled();
  });

  test('should rethrow 429 from consolidations repo without writing to HARD_STOP output', async () => {
    const { start } = await import('./migrate-childcases-to-membercases');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const rateLimitError = new TooManyRequestsError('MIGRATE-CHILDCASES-TO-MEMBERCASES');
    const mockConsolidationsRepo = {
      updateManyByQuery: vi.fn().mockRejectedValue(rateLimitError),
    };

    vi.spyOn(Factory, 'getConsolidationOrdersRepository').mockReturnValue(
      mockConsolidationsRepo as unknown as ReturnType<
        typeof Factory.getConsolidationOrdersRepository
      >,
    );

    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockResolvedValue(undefined);

    await expect(start({} as never, invocationContext)).rejects.toThrow(rateLimitError);

    const extraOutputsSet = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    expect(extraOutputsSet).not.toHaveBeenCalled();
  });

  test('should rethrow 429 from audit records phase without writing to HARD_STOP output', async () => {
    const { start } = await import('./migrate-childcases-to-membercases');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const mockConsolidationsRepo = {
      updateManyByQuery: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    };

    const rateLimitError = new TooManyRequestsError('MIGRATE-CHILDCASES-TO-MEMBERCASES');
    // Return one record that has childCases so updateCaseHistory is called
    const legacyRecord = { before: { childCases: [{}] } };
    const mockCasesRepo = {
      getAllCaseHistory: vi.fn().mockResolvedValue([legacyRecord]),
      updateCaseHistory: vi.fn().mockRejectedValue(rateLimitError),
    };

    vi.spyOn(Factory, 'getConsolidationOrdersRepository').mockReturnValue(
      mockConsolidationsRepo as unknown as ReturnType<
        typeof Factory.getConsolidationOrdersRepository
      >,
    );
    vi.spyOn(Factory, 'getCasesRepository').mockReturnValue(
      mockCasesRepo as unknown as ReturnType<typeof Factory.getCasesRepository>,
    );

    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockResolvedValue(undefined);

    await expect(start({} as never, invocationContext)).rejects.toThrow(rateLimitError);

    const extraOutputsSet = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    expect(extraOutputsSet).not.toHaveBeenCalled();
  });

  test('should write to HARD_STOP output and rethrow on non-429 error', async () => {
    const { start } = await import('./migrate-childcases-to-membercases');
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const dbError = new CamsError('MIGRATE-CHILDCASES-TO-MEMBERCASES', {
      message: 'Database connection failed',
    });
    const mockConsolidationsRepo = {
      updateManyByQuery: vi.fn().mockRejectedValue(dbError),
    };

    vi.spyOn(Factory, 'getConsolidationOrdersRepository').mockReturnValue(
      mockConsolidationsRepo as unknown as ReturnType<
        typeof Factory.getConsolidationOrdersRepository
      >,
    );

    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockResolvedValue(undefined);

    await expect(start({} as never, invocationContext)).rejects.toThrow();

    const extraOutputsSet = invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>;
    expect(extraOutputsSet).toHaveBeenCalled();
  });
});
