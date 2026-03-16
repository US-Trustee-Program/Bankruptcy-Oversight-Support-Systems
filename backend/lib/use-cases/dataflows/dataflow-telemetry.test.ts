import { vi, describe, test, expect, beforeEach } from 'vitest';
import { completeDataflowTrace, DataflowTraceResult } from './dataflow-telemetry';
import { ObservabilityGateway, ObservabilityTrace } from '../gateways.types';
import { LoggerImpl } from '../../adapters/services/logger.service';

describe('completeDataflowTrace', () => {
  let mockObservability: ObservabilityGateway;
  let mockLogger: LoggerImpl;
  let trace: ObservabilityTrace;

  beforeEach(() => {
    mockObservability = {
      startTrace: vi.fn(),
      completeTrace: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      camsError: vi.fn(),
    } as unknown as LoggerImpl;

    trace = {
      invocationId: 'test-invocation',
      instanceId: 'local',
      startTime: Date.now() - 100,
    };
  });

  test('should call observability.completeTrace with standard metrics', () => {
    const result: DataflowTraceResult = {
      documentsWritten: 5,
      documentsFailed: 2,
      success: true,
    };

    completeDataflowTrace(
      mockObservability,
      trace,
      'TEST-MODULE',
      'testHandler',
      mockLogger,
      result,
    );

    expect(mockObservability.completeTrace).toHaveBeenCalledWith(
      trace,
      'DataflowHandlerComplete',
      expect.objectContaining({
        success: true,
        measurements: { documentsWritten: 5, documentsFailed: 2 },
      }),
      expect.arrayContaining([
        { name: 'DataflowDuration', value: expect.any(Number) },
        { name: 'DataflowDocumentsWritten', value: 5 },
        { name: 'DataflowDocumentsFailed', value: 2 },
      ]),
    );

    const metricsArg = (mockObservability.completeTrace as ReturnType<typeof vi.fn>).mock
      .calls[0][3];
    expect(metricsArg).toHaveLength(3);
  });

  test('should append additionalMetrics to the metrics array when provided', () => {
    const result: DataflowTraceResult = {
      documentsWritten: 3,
      documentsFailed: 1,
      success: true,
      additionalMetrics: [
        { name: 'CustomMetric', value: 42 },
        { name: 'AnotherMetric', value: 99.5 },
      ],
    };

    completeDataflowTrace(
      mockObservability,
      trace,
      'TEST-MODULE',
      'testHandler',
      mockLogger,
      result,
    );

    const metricsArg = (mockObservability.completeTrace as ReturnType<typeof vi.fn>).mock
      .calls[0][3];
    expect(metricsArg).toHaveLength(5);
    expect(metricsArg).toEqual(
      expect.arrayContaining([
        { name: 'CustomMetric', value: 42 },
        { name: 'AnotherMetric', value: 99.5 },
      ]),
    );
  });

  test('should not include additionalMetrics when not provided', () => {
    const result: DataflowTraceResult = {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
    };

    completeDataflowTrace(
      mockObservability,
      trace,
      'TEST-MODULE',
      'testHandler',
      mockLogger,
      result,
    );

    const metricsArg = (mockObservability.completeTrace as ReturnType<typeof vi.fn>).mock
      .calls[0][3];
    expect(metricsArg).toHaveLength(3);
  });

  test('should spread details into properties', () => {
    const result: DataflowTraceResult = {
      documentsWritten: 1,
      documentsFailed: 0,
      success: true,
      details: { customKey: 'customValue', anotherKey: '123' },
    };

    completeDataflowTrace(
      mockObservability,
      trace,
      'TEST-MODULE',
      'testHandler',
      mockLogger,
      result,
    );

    const completionArg = (mockObservability.completeTrace as ReturnType<typeof vi.fn>).mock
      .calls[0][2];
    expect(completionArg.properties).toEqual(
      expect.objectContaining({
        moduleName: 'TEST-MODULE',
        handlerName: 'testHandler',
        customKey: 'customValue',
        anotherKey: '123',
      }),
    );
  });

  test('should log DATAFLOW_COMPLETE with expected fields', () => {
    const result: DataflowTraceResult = {
      documentsWritten: 10,
      documentsFailed: 3,
      success: true,
    };

    completeDataflowTrace(
      mockObservability,
      trace,
      'TEST-MODULE',
      'testHandler',
      mockLogger,
      result,
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'DATAFLOW-OBSERVABILITY',
      'DATAFLOW_COMPLETE',
      expect.objectContaining({
        moduleName: 'TEST-MODULE',
        handlerName: 'testHandler',
        documentsWritten: 10,
        documentsFailed: 3,
        success: true,
        durationMs: expect.any(Number),
        instanceId: 'local',
      }),
    );
  });
});
