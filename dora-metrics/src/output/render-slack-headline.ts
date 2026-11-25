import type { WeeklySummary } from '../metrics/weekly-summary.js';
import { weekHeadline } from './render-docs-page.js';

// Plain text for the weekly Slack post. No Slack markup or link: the posting workflow adds the
// page link and rejects any text containing '<', '>', '&' or '@'.
export function renderSlackHeadline(summary: WeeklySummary): string {
  const { week, metrics } = weekHeadline(summary);
  return [
    `DORA metrics for the week of ${week}`,
    ...metrics.map(({ label, value }) => `• ${label}: ${value}`),
  ].join('\n');
}
