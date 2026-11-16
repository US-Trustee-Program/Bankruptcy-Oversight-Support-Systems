import type { DurationSummary, WeeklySummary } from '../metrics/weekly-summary.js';
import { MS_PER_DAY } from '../metrics/period-window.js';

const HOURS_PER_DAY = 24;
const DAYS_THRESHOLD_HOURS = 48;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NO_DATA = 'No data';

export type DocsPageContext = {
  generatedAt: Date;
  // Absent when rendered outside GitHub Actions.
  run?: { id: string; url: string };
};

export function formatDuration(hours: number): string {
  return hours < DAYS_THRESHOLD_HOURS
    ? `${hours.toFixed(1)} hours`
    : `${(hours / HOURS_PER_DAY).toFixed(1)} days`;
}

function formatDate(date: Date): string {
  return `${WEEKDAYS[date.getUTCDay()]} ${date.toISOString().slice(0, 10)}`;
}

function deployments(count: number): string {
  return `${count} ${count === 1 ? 'deployment' : 'deployments'}`;
}

function formatDurationSummary(summary: DurationSummary): string {
  return summary
    ? `${formatDuration(summary.medianHours)} (mean ${formatDuration(summary.meanHours)})`
    : NO_DATA;
}

function formatChangeFailure({ changeFailure }: WeeklySummary): string {
  if (changeFailure.rate === null) {
    return `${NO_DATA} (no deployments)`;
  }
  const percent = (changeFailure.rate * 100).toFixed(1);
  return `${percent}% (${changeFailure.failedDeployments} of ${deployments(changeFailure.totalDeployments)})`;
}

function formatSource({ generatedAt, run }: DocsPageContext): string {
  const source = run ? `[DORA Metrics run ${run.id}](${run.url})` : 'local run';
  return `Generated ${generatedAt.toISOString()} from ${source}`;
}

export function renderDocsPage(summary: WeeklySummary, context: DocsPageContext): string {
  const lastDay = new Date(summary.periodEnd.getTime() - MS_PER_DAY);
  return [
    '# DORA Metrics',
    '',
    'These numbers update weekly, after the Monday DORA Metrics run.',
    '',
    `## Week of ${formatDate(summary.periodStart)} – ${formatDate(lastDay)} (UTC)`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Deployment frequency | ${deployments(summary.deploymentCount)} (${summary.deploymentsPerDay.toFixed(1)} per day) |`,
    `| Lead time for changes | ${formatDurationSummary(summary.leadTime)} |`,
    `| Change failure rate | ${formatChangeFailure(summary)} |`,
    `| Time to restore service | ${formatDurationSummary(summary.restoreTime)} |`,
    '',
    formatSource(context),
    '',
  ].join('\n');
}
