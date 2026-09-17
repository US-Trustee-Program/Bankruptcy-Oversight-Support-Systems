import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';

describe('UseApplicationInsights', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test.each([
    ['undefined', undefined],
    ['empty string', ''],
  ])('should not load app insights when connection string is %s', async (_, connectionString) => {
    const mockLoadAppInsights = vi.fn();
    const mockAddTelemetryInitializer = vi.fn();
    const mockTrackEvent = vi.fn();

    vi.doMock('@microsoft/applicationinsights-web', () => ({
      ApplicationInsights: vi.fn(function () {
        return {
          loadAppInsights: mockLoadAppInsights,
          addTelemetryInitializer: mockAddTelemetryInitializer,
          trackEvent: mockTrackEvent,
        };
      }),
    }));
    vi.doMock('@microsoft/applicationinsights-react-js', () => ({
      ReactPlugin: vi.fn(function () {}),
    }));
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({ applicationInsightsConnectionString: connectionString }),
    }));

    await import('./UseApplicationInsights');

    expect(mockLoadAppInsights).not.toHaveBeenCalled();
    expect(mockAddTelemetryInitializer).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test('should load app insights when connection string is provided', async () => {
    const mockLoadAppInsights = vi.fn();
    const mockAddTelemetryInitializer = vi.fn();
    const mockTrackEvent = vi.fn();

    vi.doMock('@microsoft/applicationinsights-web', () => ({
      ApplicationInsights: vi.fn(function () {
        return {
          loadAppInsights: mockLoadAppInsights,
          addTelemetryInitializer: mockAddTelemetryInitializer,
          trackEvent: mockTrackEvent,
        };
      }),
    }));
    vi.doMock('@microsoft/applicationinsights-react-js', () => ({
      ReactPlugin: vi.fn(function () {}),
    }));
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({
        applicationInsightsConnectionString: 'InstrumentationKey=test-key',
      }),
    }));

    await import('./UseApplicationInsights');

    expect(mockLoadAppInsights).toHaveBeenCalled();
    expect(mockAddTelemetryInitializer).toHaveBeenCalled();
  });

  test('should track viewport size when connection string is provided', async () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);

    const mockTrackEvent = vi.fn();

    vi.doMock('@microsoft/applicationinsights-web', () => ({
      ApplicationInsights: vi.fn(function () {
        return {
          loadAppInsights: vi.fn(),
          addTelemetryInitializer: vi.fn(),
          trackEvent: mockTrackEvent,
        };
      }),
    }));
    vi.doMock('@microsoft/applicationinsights-react-js', () => ({
      ReactPlugin: vi.fn(function () {}),
    }));
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({
        applicationInsightsConnectionString: 'InstrumentationKey=test-key',
      }),
    }));

    await import('./UseApplicationInsights');

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      { name: 'Viewport Size' },
      { width: 1280, height: 720 },
    );
  });

  async function setupTelemetryCapture() {
    type TelemetryInitializer = (env: Record<string, unknown>) => void;
    let capturedInitializer: TelemetryInitializer | undefined;

    vi.doMock('@microsoft/applicationinsights-web', () => ({
      ApplicationInsights: vi.fn(function () {
        return {
          loadAppInsights: vi.fn(),
          addTelemetryInitializer: vi.fn(function (fn: TelemetryInitializer) {
            capturedInitializer = fn;
          }),
          trackEvent: vi.fn(),
        };
      }),
    }));
    vi.doMock('@microsoft/applicationinsights-react-js', () => ({
      ReactPlugin: vi.fn(function () {}),
    }));
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({ applicationInsightsConnectionString: 'InstrumentationKey=test-key' }),
    }));

    await import('./UseApplicationInsights');
    return capturedInitializer!;
  }

  test('should initialize tags to empty array and set cloud role when env.tags is undefined', async () => {
    const capturedInitializer = await setupTelemetryCapture();

    expect(capturedInitializer).toBeDefined();
    const env: Record<string, unknown> = {};
    capturedInitializer(env);

    expect(Array.isArray(env.tags)).toBe(true);
    expect((env.tags as Record<string, string>)['ai.cloud.role']).toBe('ustp.cams.web');
  });

  test('should preserve existing tags object when env.tags is already set', async () => {
    const capturedInitializer = await setupTelemetryCapture();

    expect(capturedInitializer).toBeDefined();
    const existingTags: Record<string, string> = { 'existing-tag': 'value' };
    const env: Record<string, unknown> = { tags: existingTags };
    capturedInitializer(env);

    expect(env.tags).toBe(existingTags);
    expect((env.tags as Record<string, string>)['ai.cloud.role']).toBe('ustp.cams.web');
  });

  test('should return reactPlugin and appInsights from getAppInsights', async () => {
    const mockAppInsightsInstance = {
      loadAppInsights: vi.fn(),
      addTelemetryInitializer: vi.fn(),
      trackEvent: vi.fn(),
    };
    const mockReactPluginInstance = {};

    vi.doMock('@microsoft/applicationinsights-web', () => ({
      ApplicationInsights: vi.fn(function () {
        return mockAppInsightsInstance;
      }),
    }));
    vi.doMock('@microsoft/applicationinsights-react-js', () => ({
      ReactPlugin: vi.fn(function () {
        return mockReactPluginInstance;
      }),
    }));
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({ applicationInsightsConnectionString: undefined }),
    }));

    const { getAppInsights } = await import('./UseApplicationInsights');
    const result = getAppInsights();

    expect(result.appInsights).toBe(mockAppInsightsInstance);
    expect(result.reactPlugin).toBe(mockReactPluginInstance);
  });
});
