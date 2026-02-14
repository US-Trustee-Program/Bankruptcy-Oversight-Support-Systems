import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { LoggerImpl } from './logger.service';
import {
  startTrace,
  completeTrace,
  scrubErrorForTelemetry,
  DataflowTrace,
} from './dataflow-observability';

vi.mock('../../../function-apps/azure/app-insights', () => ({
  getAppInsightsClient: vi.fn(),
}));

import { getAppInsightsClient } from '../../../function-apps/azure/app-insights';

const TEST_INVOCATION_ID = 'test-invocation-id';

describe('DataflowObservability', () => {
  let mockLogger: LoggerImpl;
  const mockedGetClient = vi.mocked(getAppInsightsClient);

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogger = new LoggerImpl(TEST_INVOCATION_ID, vi.fn());
  });

  describe('startTrace', () => {
    afterEach(() => {
      delete process.env.WEBSITE_INSTANCE_ID;
    });

    test('should capture module name, handler name, invocation ID, and logger', () => {
      const trace = startTrace('SYNC-CASES', 'handleStart', TEST_INVOCATION_ID, mockLogger);

      expect(trace.moduleName).toBe('SYNC-CASES');
      expect(trace.handlerName).toBe('handleStart');
      expect(trace.invocationId).toBe(TEST_INVOCATION_ID);
      expect(trace.logger).toBe(mockLogger);
      expect(trace.startTime).toBeLessThanOrEqual(Date.now());
    });

    test('should use WEBSITE_INSTANCE_ID env var when available', () => {
      process.env.WEBSITE_INSTANCE_ID = 'instance-abc';
      const trace = startTrace('SYNC-CASES', 'handleStart', TEST_INVOCATION_ID, mockLogger);

      expect(trace.instanceId).toBe('instance-abc');
    });

    test('should fall back to local when WEBSITE_INSTANCE_ID is not set', () => {
      delete process.env.WEBSITE_INSTANCE_ID;
      const trace = startTrace('SYNC-CASES', 'handleStart', TEST_INVOCATION_ID, mockLogger);

      expect(trace.instanceId).toBe('local');
    });
  });

  describe('completeTrace', () => {
    let trace: DataflowTrace;

    beforeEach(() => {
      vi.restoreAllMocks();
      mockLogger = new LoggerImpl(TEST_INVOCATION_ID, vi.fn());
      delete process.env.WEBSITE_INSTANCE_ID;
      trace = startTrace('SYNC-CASES', 'handleStart', TEST_INVOCATION_ID, mockLogger);
    });

    test('should log a structured DATAFLOW_COMPLETE message', () => {
      const logSpy = vi.spyOn(mockLogger, 'info');

      completeTrace(trace, { documentsWritten: 5, documentsFailed: 2, success: true });

      expect(logSpy).toHaveBeenCalledWith(
        'DATAFLOW-OBSERVABILITY',
        expect.stringContaining(
          'DATAFLOW_COMPLETE module=SYNC-CASES handler=handleStart docs=5 failed=2',
        ),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'DATAFLOW-OBSERVABILITY',
        expect.stringContaining('instance=local success=true'),
      );
    });

    test('should include invocationId in Application Insights properties', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, { documentsWritten: 0, documentsFailed: 0, success: true });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            invocationId: TEST_INVOCATION_ID,
          }),
        }),
      );
    });

    test('should call Application Insights trackEvent when client exists', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, { documentsWritten: 10, documentsFailed: 3, success: true });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataflowHandlerComplete',
          properties: expect.objectContaining({
            moduleName: 'SYNC-CASES',
            handlerName: 'handleStart',
            instanceId: 'local',
            success: 'true',
          }),
          measurements: expect.objectContaining({
            documentsWritten: 10,
            documentsFailed: 3,
          }),
        }),
      );
    });

    test('should call Application Insights trackMetric for duration, documents, and failures', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, { documentsWritten: 3, documentsFailed: 1, success: true });

      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataflowDuration',
        }),
      );
      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataflowDocumentsWritten',
          value: 3,
        }),
      );
      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataflowDocumentsFailed',
          value: 1,
        }),
      );
    });

    test('should still log when Application Insights client is missing', () => {
      mockedGetClient.mockReturnValue(null);
      const logSpy = vi.spyOn(mockLogger, 'info');

      completeTrace(trace, { documentsWritten: 5, documentsFailed: 0, success: true });

      expect(logSpy).toHaveBeenCalledWith(
        'DATAFLOW-OBSERVABILITY',
        expect.stringContaining('DATAFLOW_COMPLETE'),
      );
    });

    test('should include extra details in properties', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, {
        documentsWritten: 1,
        documentsFailed: 0,
        success: true,
        details: { totalEvents: '50', reason: 'test' },
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            totalEvents: '50',
            reason: 'test',
          }),
        }),
      );
    });

    test('should include scrubbed error in properties when provided', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'Failed: 123-45-6789 connection issue',
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            error: 'Failed: [REDACTED] connection issue',
          }),
        }),
      );
    });

    test('should not include error property when not provided', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      completeTrace(trace, { documentsWritten: 0, documentsFailed: 0, success: true });

      const callArgs = mockTrackEvent.mock.calls[0][0];
      expect(callArgs.properties).not.toHaveProperty('error');
    });

    test('should report success as false when operation fails', () => {
      const logSpy = vi.spyOn(mockLogger, 'info');

      completeTrace(trace, { documentsWritten: 0, documentsFailed: 0, success: false });

      expect(logSpy).toHaveBeenCalledWith(
        'DATAFLOW-OBSERVABILITY',
        expect.stringContaining('success=false'),
      );
    });
  });

  describe('scrubErrorForTelemetry', () => {
    test('should redact SSN-like patterns', () => {
      const result = scrubErrorForTelemetry('Failed for debtor 123-45-6789');
      expect(result).toBe('Failed for debtor [REDACTED]');
    });

    test('should redact MongoDB connection strings', () => {
      const result = scrubErrorForTelemetry(
        'MongoServerError: mongodb+srv://user:pass@cluster.mongodb.net/db failed', // pragma: allowlist secret
      );
      expect(result).toContain('[CONNECTION_STRING_REDACTED]');
      expect(result).not.toContain('user:pass');
    });

    test('should redact MSSQL connection strings', () => {
      const result = scrubErrorForTelemetry(
        'ConnectionError: Server=myserver.database.windows.net;Database=mydb;User=admin;Password=secret',
      );
      expect(result).toContain('[CONNECTION_STRING_REDACTED]');
      expect(result).not.toContain('Password=secret');
    });

    test('should collapse newlines', () => {
      const result = scrubErrorForTelemetry('Error: something\nStack trace\n  at file.ts:1');
      expect(result).not.toContain('\n');
    });

    test('should pass through safe error messages unchanged', () => {
      const result = scrubErrorForTelemetry('Failed to sync case 081-23-12345');
      expect(result).toBe('Failed to sync case 081-23-12345');
    });
  });
});
