export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}

let isConfigured = false;

/**
 * Disables console auto-collection in Application Insights SDK to prevent duplicate logs.
 *
 * When running in Azure Functions, the Functions host captures logs via invocationContext.log()
 * and sends them to Application Insights. The App Insights SDK also auto-collects console output
 * by default, causing duplicate log entries. This function disables console auto-collection while
 * preserving custom event and metric tracking.
 *
 * This should be called once during application startup, before any functions are invoked.
 * Uses a singleton pattern to ensure it only runs once.
 */
export function configureAppInsights(): void {
  if (isConfigured) return;

  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      console.warn('[APP-INSIGHTS] applicationinsights module loaded but is falsy');
      isConfigured = true;
      return;
    }

    if (!appInsights.defaultClient) {
      console.warn(
        '[APP-INSIGHTS] SDK not initialized yet - will be configured by Azure Functions',
      );
      return;
    }

    // Disable console auto-collection to prevent duplicate logs
    // The Functions host already captures logs via invocationContext.log()
    if (appInsights.Configuration?.setAutoCollectConsole) {
      appInsights.Configuration.setAutoCollectConsole(false);
      console.log('[APP-INSIGHTS] Console auto-collection disabled to prevent duplicate logs');
    }

    isConfigured = true;
  } catch (error) {
    console.error('[APP-INSIGHTS] Failed to configure applicationinsights:', error);
    isConfigured = true;
  }
}

export function getAppInsightsClient(): TelemetryClient | null {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      console.warn('[APP-INSIGHTS] applicationinsights module loaded but is falsy');
      return null;
    }

    if (!appInsights.defaultClient) {
      console.warn('[APP-INSIGHTS] SDK not initialized - defaultClient is null/undefined');
      return null;
    }

    return appInsights.defaultClient as TelemetryClient;
  } catch (error) {
    console.error('[APP-INSIGHTS] Failed to load applicationinsights module:', error);
    return null;
  }
}
