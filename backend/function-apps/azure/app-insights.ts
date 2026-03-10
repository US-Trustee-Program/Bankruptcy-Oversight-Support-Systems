export interface TelemetryClient {
  trackEvent(event: {
    name: string;
    properties: Record<string, string>;
    measurements: Record<string, number>;
  }): void;
  trackMetric(metric: { name: string; value: number; properties: Record<string, string> }): void;
}
