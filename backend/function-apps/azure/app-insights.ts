export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}

export function getAppInsightsClient(): TelemetryClient | null {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      console.warn('[OBSERVABILITY] applicationinsights module loaded but is falsy');
      return null;
    }

    if (!appInsights.defaultClient) {
      console.warn(
        '[OBSERVABILITY] applicationinsights.defaultClient is null/undefined - SDK not initialized',
      );
      return null;
    }

    return appInsights.defaultClient as TelemetryClient;
  } catch (error) {
    console.error('[OBSERVABILITY] Failed to load applicationinsights module:', error);
    return null;
  }
}
