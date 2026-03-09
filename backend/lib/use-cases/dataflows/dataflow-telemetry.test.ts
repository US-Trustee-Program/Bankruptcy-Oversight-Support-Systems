import { vi } from 'vitest';
import { ObservabilityGateway, ObservabilityTrace } from '../gateways.types';
import { LoggerImpl } from '../../adapters/services/logger.service';
import { completeDataflowTrace, DataflowTraceResult } from './dataflow-telemetry';

function makeMockTrace(startTime = Date.now() - 100): ObservabilityTrace {
  return { invocationId: 'inv-123', instanceId: 'instance-abc', startTime };
}

function makeMockObservability(): ObservabilityGateway {
  return {
    startTrace: vi.fn(),
    completeTrace: vi.fn(),
  };
}

function makeMockLogger(): LoggerImpl {
  return { info: vi.fn() } as unknown as LoggerImpl;
}

describe('completeDataflowTrace', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call logger.info and observability.completeTrace with correct values', () => {
    const trace = makeMockTrace();
    const observability = makeMockObservability();
    const logger = makeMockLogger();
    const result: DataflowTraceResult = {
      documentsWritten: 5,
      documentsFailed: 1,
      success: true,
    };

    completeDataflowTrace(observability, trace, 'MY-MODULE', 'handleStart', logger, result);

    expect(logger.info).toHaveBeenCalledWith(
      'DATAFLOW-OBSERVABILITY',
      'DATAFLOW_COMPLETE',
      expect.objectContaining({
        moduleName: 'MY-MODULE',
        handlerName: 'handleStart',
        documentsWritten: 5,
        documentsFailed: 1,
        instanceId: trace.instanceId,
        success: true,
        durationMs: expect.any(Number),
      }),
    );

    expect(observability.completeTrace).toHaveBeenCalledWith(
      trace,
      'DataflowHandlerComplete',
      {
        success: true,
        properties: { moduleName: 'MY-MODULE', handlerName: 'handleStart' },
        measurements: { documentsWritten: 5, documentsFailed: 1 },
        error: undefined,
      },
      [
        { name: 'DataflowDuration', value: expect.any(Number) },
        { name: 'DataflowDocumentsWritten', value: 5 },
        { name: 'DataflowDocumentsFailed', value: 1 },
      ],
    );
  });

  test('should spread result.details into properties', () => {
    const trace = makeMockTrace();
    const observability = makeMockObservability();
    const logger = makeMockLogger();
    const result: DataflowTraceResult = {
      documentsWritten: 10,
      documentsFailed: 0,
      success: true,
      details: { pagesQueued: '3', totalEvents: '300' },
    };

    completeDataflowTrace(observability, trace, 'SYNC-CASES', 'handleStart', logger, result);

    expect(observability.completeTrace).toHaveBeenCalledWith(
      trace,
      'DataflowHandlerComplete',
      expect.objectContaining({
        properties: {
          moduleName: 'SYNC-CASES',
          handlerName: 'handleStart',
          pagesQueued: '3',
          totalEvents: '300',
        },
      }),
      expect.any(Array),
    );
  });

  test('should pass error message through to completeTrace', () => {
    const trace = makeMockTrace();
    const observability = makeMockObservability();
    const logger = makeMockLogger();
    const result: DataflowTraceResult = {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: 'Something went wrong',
    };

    completeDataflowTrace(observability, trace, 'MY-MODULE', 'handleStart', logger, result);

    expect(observability.completeTrace).toHaveBeenCalledWith(
      trace,
      'DataflowHandlerComplete',
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }),
      expect.any(Array),
    );
  });
});
