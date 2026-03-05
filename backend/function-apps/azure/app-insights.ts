import * as appInsights from 'applicationinsights';

export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}

/**
 * Initializes the Application Insights SDK with console auto-collection DISABLED.
 * This prevents duplicate logs when running in Azure Functions, where the runtime
 * already captures console output and sends it to Application Insights.
 *
 * Key configuration:
 * - Console auto-collection: DISABLED (both general and console.log specifically)
 * - Request auto-collection: DISABLED (Azure Functions runtime handles this)
 * - Exception tracking: ENABLED
 * - Live metrics: ENABLED
 *
 * @returns TelemetryClient instance or null if initialization fails
 */
export function getOrInitializeAppInsightsClient(): TelemetryClient | null {
  try {
    // 1. If SDK already initialized (by Azure Functions runtime), return existing client
    if (appInsights.defaultClient) {
      console.log(
        '[APP-INSIGHTS] SDK already initialized (likely by Azure Functions runtime) - using existing client',
      );
      return appInsights.defaultClient as unknown as TelemetryClient;
    }

    // 2. SDK not initialized - initialize it ourselves with proper configuration
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
      console.error(
        '[APP-INSIGHTS] CRITICAL: APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry unavailable',
      );
      return null;
    }

    console.log('[APP-INSIGHTS] Initializing Application Insights SDK explicitly');

    /**
     * CRITICAL: Use chained configuration BEFORE .start() to prevent console hooks
     * from being attached. This must happen before the SDK initializes its listeners.
     *
     * - setAutoCollectConsole(false, false): BOTH parameters must be false
     *   - First param disables general console collection
     *   - Second param disables console.log specifically
     * - setAutoCollectRequests(false): Azure Functions runtime already tracks HTTP requests
     * - setAutoCollectExceptions(true): Keep crash reporting
     * - setSendLiveMetrics(true): Enable live metrics
     */
    appInsights
      .setup(connectionString)
      .setAutoCollectConsole(false, false) // Disable console wrappers entirely
      .setAutoCollectRequests(false) // Functions handles request tracking natively
      .setAutoCollectExceptions(true) // Keep crash reporting
      .setSendLiveMetrics(true) // Enable live metrics
      .start();

    if (!appInsights.defaultClient) {
      console.error(
        '[APP-INSIGHTS] CRITICAL: App Insights SDK initialized but defaultClient still null',
      );
      return null;
    }

    console.log('[APP-INSIGHTS] SDK initialized successfully (Console auto-collection: DISABLED)');

    return appInsights.defaultClient as unknown as TelemetryClient;
  } catch (error) {
    console.error('[APP-INSIGHTS] CRITICAL: Failed to initialize Application Insights', error);
    return null;
  }
}

/**
 * Simple getter for the Application Insights client if already initialized.
 * Use this when you know the SDK has already been set up.
 *
 * @returns TelemetryClient instance or null if not initialized
 */
export function getAppInsightsClient(): TelemetryClient | null {
  try {
    if (!appInsights.defaultClient) {
      console.warn('[APP-INSIGHTS] SDK not initialized - defaultClient is null/undefined');
      return null;
    }

    return appInsights.defaultClient as unknown as TelemetryClient;
  } catch (error) {
    console.error('[APP-INSIGHTS] Failed to get applicationinsights client:', error);
    return null;
  }
}
