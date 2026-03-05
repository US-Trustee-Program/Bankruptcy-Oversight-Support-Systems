import * as appInsights from 'applicationinsights';

export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}

export function getOrInitializeAppInsightsClient(): TelemetryClient | null {
  try {
    console.trace('[APP-INSIGHTS] Tracing application insights initialization.');
    if (appInsights.defaultClient) {
      console.log(
        '[APP-INSIGHTS] SDK already initialized (likely by Azure Functions runtime) - using existing client',
      );
      return appInsights.defaultClient as unknown as TelemetryClient;
    }

    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
      console.error(
        '[APP-INSIGHTS] CRITICAL: APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry unavailable',
      );
      return null;
    }

    console.log('[APP-INSIGHTS] Initializing Application Insights SDK explicitly');

    appInsights
      .setup(connectionString)
      .setAutoCollectConsole(false, false)
      .setAutoCollectRequests(false)
      .setAutoCollectExceptions(true)
      .setSendLiveMetrics(true)
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
