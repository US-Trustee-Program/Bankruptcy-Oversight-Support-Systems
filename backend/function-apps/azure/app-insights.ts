export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}

/**
 * Singleton flag to ensure Application Insights console configuration only happens once.
 * This flag is shared across multiple call sites (application-context-creator.ts, dataflows.ts,
 * and observability.ts) and prevents duplicate configuration attempts.
 *
 * Only set to true after successful configuration. Not set on failure paths to allow retries
 * in case of transient issues.
 */
let isConfigured = false;

/**
 * Disables console auto-collection in Application Insights SDK to prevent duplicate logs.
 *
 * When running in Azure Functions, the Functions host captures logs via invocationContext.log()
 * and sends them to Application Insights. The App Insights SDK also auto-collects console output
 * by default, causing duplicate log entries. This function disables console auto-collection while
 * preserving custom event and metric tracking.
 *
 * This should be called:
 * 1. Once during application startup (from dataflows.ts, application-context-creator.ts)
 * 2. After manual SDK initialization (from getOrInitializeAppInsightsClient in observability.ts)
 *
 * Uses a singleton pattern (isConfigured flag) to ensure it only runs once, even when called
 * from multiple locations.
 */
export function configureAppInsights(): void {
  if (isConfigured) return;

  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      console.warn('[APP-INSIGHTS] applicationinsights module loaded but is falsy');
      // Don't set isConfigured - allow retry in case this is a transient issue
      return;
    }

    if (!appInsights.defaultClient) {
      console.warn('[APP-INSIGHTS] SDK not initialized yet - will retry after initialization');
      // Don't set isConfigured - will retry after SDK initialization
      return;
    }

    // Disable console auto-collection to prevent duplicate logs
    // The Functions host already captures logs via invocationContext.log()
    // Using the documented API: setAutoCollectConsole(enable, collectConsoleLog)
    if (appInsights.Configuration?.setAutoCollectConsole) {
      appInsights.Configuration.setAutoCollectConsole(false, false);
      console.log('[APP-INSIGHTS] Console auto-collection disabled to prevent duplicate logs');
    }

    // Only mark as configured after successful configuration
    isConfigured = true;
  } catch (error) {
    console.error('[APP-INSIGHTS] Failed to configure applicationinsights:', error);
    // Don't set isConfigured - allow retry in case this is a transient issue
  }
}

/**
 * Initializes and returns the Application Insights client.
 * If the client doesn't exist, explicitly initializes the SDK.
 *
 * This function centralizes all App Insights initialization logic:
 * 1. Checks if SDK is already initialized
 * 2. If not, initializes it with the connection string
 * 3. Configures the SDK to disable console auto-collection
 *
 * @returns TelemetryClient instance or null if initialization fails
 */
export function getOrInitializeAppInsightsClient(): TelemetryClient | null {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      console.error('[APP-INSIGHTS] applicationinsights module loaded but is falsy');
      return null;
    }

    // If defaultClient already exists, return it
    if (appInsights.defaultClient) {
      return appInsights.defaultClient as TelemetryClient;
    }

    // Client doesn't exist - try to initialize it ourselves
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
      console.error(
        '[APP-INSIGHTS] CRITICAL: APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry unavailable',
      );
      return null;
    }

    console.log('[APP-INSIGHTS] Initializing Application Insights SDK explicitly');
    appInsights.setup(connectionString).start();

    if (!appInsights.defaultClient) {
      console.error(
        '[APP-INSIGHTS] CRITICAL: App Insights SDK initialized but defaultClient still null',
      );
      return null;
    }

    console.log('[APP-INSIGHTS] Application Insights SDK initialized successfully');

    // Configure App Insights to disable console auto-collection after initialization
    configureAppInsights();

    return appInsights.defaultClient as TelemetryClient;
  } catch (error) {
    console.error('[APP-INSIGHTS] CRITICAL: Failed to initialize Application Insights', error);
    return null;
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
