import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TraceCompletion } from '../../use-cases/gateways.types';
import { LoggerImpl } from './logger.service';
import { AppInsightsObservability, scrubErrorForTelemetry } from './observability';
import { TelemetryClient } from '../../../function-apps/azure/app-insights';

const mockTrackEvent = vi.fn();
const mockTrackMetric = vi.fn();
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerImpl;

const mockClient = {
  trackEvent: mockTrackEvent,
  trackMetric: mockTrackMetric,
} as unknown as TelemetryClient;

const mockClientFactory = vi.fn(() => mockClient);

const TEST_INVOCATION_ID = 'test-invocation-id';

describe('AppInsightsObservability', () => {
  let gateway: AppInsightsObservability;

  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockTrackMetric.mockClear();
    mockClientFactory.mockClear();
    vi.mocked(mockLogger.warn).mockClear();
    vi.mocked(mockLogger.error).mockClear();
    gateway = new AppInsightsObservability(undefined, mockClientFactory);
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
    test('should call trackEvent with event name, properties, and measurements when defaultClient exists', () => {
      const gatewayWithLogger = new AppInsightsObservability(mockLogger, mockClientFactory);
      const trace = gatewayWithLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: { searchType: 'standard' },
        measurements: { resultCount: 10 },
      };

      gatewayWithLogger.completeTrace(trace, 'TestEvent', completion);

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

    test('should call trackMetric for each metric provided when defaultClient exists', () => {
      const gatewayWithLogger = new AppInsightsObservability(mockLogger, mockClientFactory);
      const trace = gatewayWithLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: {},
        measurements: {},
      };
      const metrics = [
        { name: 'MetricA', value: 42 },
        { name: 'MetricB', value: 7 },
      ];

      gatewayWithLogger.completeTrace(trace, 'TestEvent', completion, metrics);

      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MetricA', value: 42 }),
      );
      expect(mockTrackMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MetricB', value: 7 }),
      );
    });

    test('should include scrubbed error in properties when provided', () => {
      const gatewayWithLogger = new AppInsightsObservability(mockLogger, mockClientFactory);
      const trace = gatewayWithLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: false,
        properties: {},
        measurements: {},
        error: 'Failed: 123-45-6789 connection issue',
      };

      gatewayWithLogger.completeTrace(trace, 'TestEvent', completion);

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            error: 'Failed: [REDACTED] connection issue',
          }),
        }),
      );
    });

    test('should log the client-unavailable diagnostic with the call-time logger over the cached one', () => {
      const cachedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as LoggerImpl;
      const callTimeLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as LoggerImpl;
      const nullClientFactory = vi.fn(() => null);
      const gatewayWithCachedLogger = new AppInsightsObservability(cachedLogger, nullClientFactory);
      const trace = gatewayWithCachedLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = { success: false, properties: {}, measurements: {} };

      gatewayWithCachedLogger.completeTrace(
        trace,
        'TestEvent',
        completion,
        undefined,
        callTimeLogger,
      );

      expect(vi.mocked(callTimeLogger.error)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('App Insights client unavailable'),
      );
      expect(vi.mocked(cachedLogger.error)).not.toHaveBeenCalled();
      expect(nullClientFactory).toHaveBeenCalledWith(callTimeLogger);
    });

    test('should fall back to the cached logger when no call-time logger is provided', () => {
      const cachedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as LoggerImpl;
      const nullClientFactory = vi.fn(() => null);
      const gatewayWithCachedLogger = new AppInsightsObservability(cachedLogger, nullClientFactory);
      const trace = gatewayWithCachedLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = { success: false, properties: {}, measurements: {} };

      gatewayWithCachedLogger.completeTrace(trace, 'TestEvent', completion);

      expect(vi.mocked(cachedLogger.error)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('App Insights client unavailable'),
      );
    });

    test('should not include error property when not provided', () => {
      const gatewayWithLogger = new AppInsightsObservability(mockLogger, mockClientFactory);
      const trace = gatewayWithLogger.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = {
        success: true,
        properties: {},
        measurements: {},
      };

      gatewayWithLogger.completeTrace(trace, 'TestEvent', completion);

      const callArgs = mockTrackEvent.mock.calls[0][0];
      expect(callArgs.properties).not.toHaveProperty('error');
    });
  });

  describe('completeTrace - default client factory', () => {
    // getOrInitializeAppInsightsClient() (the default clientFactory used when
    // no override is passed to the constructor) loads the 'applicationinsights'
    // package via a literal require() call. vi.mock()/vi.doMock() do not
    // intercept that call in this project's vitest config -- confirmed by a
    // throwaway test asserting require('applicationinsights') returns the
    // mock: it returned the real package every time. So only the real,
    // unconfigured SDK's actual behavior can be exercised here, not the
    // module-falsy, already-has-a-defaultClient, or SDK-initializes paths,
    // which would require either mocking require() (not possible) or driving
    // the real SDK's setup()/start() in-process (unsafe side effects for a
    // unit test). See cams-npm-packages / cams-testing-unit for the
    // vi.mock-vs-require limitation.
    const originalConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    afterEach(() => {
      if (originalConnectionString === undefined) {
        delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      } else {
        process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalConnectionString;
      }
    });

    test('returns null and logs when no defaultClient exists and the connection string is unset', () => {
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

      // This test only works because nothing else in this file ever provides
      // a connection string to getOrInitializeAppInsightsClient, so the real
      // SDK's defaultClient getter (which can't be reset directly -- it has
      // no setter) stays unset for the lifetime of this file's isolated
      // Vitest worker. Trip this precondition loudly rather than silently
      // misattributing a failure to production code if that ever changes.
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      expect(require('applicationinsights').defaultClient).toBeUndefined();

      const gatewayWithDefaultFactory = new AppInsightsObservability(mockLogger);
      const trace = gatewayWithDefaultFactory.startTrace(TEST_INVOCATION_ID);
      const completion: TraceCompletion = { success: false, properties: {}, measurements: {} };

      gatewayWithDefaultFactory.completeTrace(trace, 'TestEvent', completion);

      expect(vi.mocked(mockLogger.error)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('APPLICATIONINSIGHTS_CONNECTION_STRING not set'),
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
