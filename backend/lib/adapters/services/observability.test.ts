import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AppInsightsObservability, scrubErrorForTelemetry } from './observability';
import { TraceCompletion } from '../../use-cases/gateways.types';

vi.mock('../../../function-apps/azure/app-insights', () => ({
  getAppInsightsClient: vi.fn(),
}));

import { getAppInsightsClient } from '../../../function-apps/azure/app-insights';

const TEST_INVOCATION_ID = 'test-invocation-id';

describe('AppInsightsObservability', () => {
  const mockedGetClient = vi.mocked(getAppInsightsClient);
  let gateway: AppInsightsObservability;

  beforeEach(() => {
    vi.restoreAllMocks();
    gateway = new AppInsightsObservability();
  });

  describe('startTrace', () => {
    afterEach(() => {
      delete process.env.WEBSITE_INSTANCE_ID;
    });

    test('should capture invocationId and startTime', () => {
      const trace = gateway.startTrace(TEST_INVOCATION_ID);

      expect(trace.invocationId).toBe(TEST_INVOCATION_ID);
      expect(trace.startTime).toBeLessThanOrEqual(Date.now());
    });

    test('should use WEBSITE_INSTANCE_ID env var when available', () => {
      process.env.WEBSITE_INSTANCE_ID = 'instance-abc';
      const trace = gateway.startTrace(TEST_INVOCATION_ID);

      expect(trace.instanceId).toBe('instance-abc');
    });

    test('should fall back to local when WEBSITE_INSTANCE_ID is not set', () => {
      delete process.env.WEBSITE_INSTANCE_ID;
      const trace = gateway.startTrace(TEST_INVOCATION_ID);

      expect(trace.instanceId).toBe('local');
    });
  });

  describe('completeTrace', () => {
    test('should call trackEvent with event name, properties, and measurements', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      const trace = gateway.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: { searchType: 'standard' },
        measurements: { resultCount: 10 },
      };

      gateway.completeTrace(trace, 'TestEvent', completion);

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestEvent',
          properties: expect.objectContaining({
            instanceId: 'local',
            invocationId: TEST_INVOCATION_ID,
            success: 'true',
            searchType: 'standard',
          }),
          measurements: expect.objectContaining({
            durationMs: expect.any(Number),
            resultCount: 10,
          }),
        }),
      );
    });

    test('should call trackMetric for each metric provided', () => {
      const mockTrackEvent = vi.fn();
      const mockTrackMetric = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: mockTrackMetric,
      });

      const trace = gateway.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: {},
        measurements: {},
      };
      const metrics = [
        { name: 'MetricA', value: 42 },
        { name: 'MetricB', value: 7 },
      ];

      gateway.completeTrace(trace, 'TestEvent', completion, metrics);

      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MetricA', value: 42 }),
      );
      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MetricB', value: 7 }),
      );
    });

    test('should include scrubbed error in properties when provided', () => {
      const mockTrackEvent = vi.fn();
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: vi.fn(),
      });

      const trace = gateway.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: false,
        properties: {},
        measurements: {},
        error: 'Failed: 123-45-6789 connection issue',
      };

      gateway.completeTrace(trace, 'TestEvent', completion);

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
      mockedGetClient.mockReturnValue({
        trackEvent: mockTrackEvent,
        trackMetric: vi.fn(),
      });

      const trace = gateway.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: {},
        measurements: {},
      };

      gateway.completeTrace(trace, 'TestEvent', completion);

      const callArgs = mockTrackEvent.mock.calls[0][0];
      expect(callArgs.properties).not.toHaveProperty('error');
    });

    test('should not call App Insights when client is missing', () => {
      mockedGetClient.mockReturnValue(null);

      const trace = gateway.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: {},
        measurements: {},
      };

      gateway.completeTrace(trace, 'TestEvent', completion);

      expect(mockedGetClient).toHaveBeenCalled();
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
