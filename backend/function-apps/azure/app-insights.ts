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
    return (appInsights.defaultClient as TelemetryClient) ?? null;
  } catch {
    return null;
  }
}
