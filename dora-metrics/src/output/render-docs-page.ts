import type { DurationSummary, WeeklySummary } from '../metrics/weekly-summary.js';
import { MS_PER_DAY } from '../metrics/period-window.js';

const HOURS_PER_DAY = 24;
const DAYS_THRESHOLD_HOURS = 48;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NO_DATA = 'No data';
const NO_DATA_IN_WEEKS = 'No data in these weeks';
// Mermaid's default xychart line is a pale lavender that barely shows on the white docs page.
const CHART_THEME = '%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%';

export type DocsPageContext = {
  generatedAt: Date;
  // Absent when rendered outside GitHub Actions.
  run?: { id: string; url: string };
};

function formatDuration(hours: number): string {
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
  return `${formatPercent(changeFailure.rate)}% (${changeFailure.failedDeployments} of ${deployments(changeFailure.totalDeployments)})`;
}

function formatSource({ generatedAt, run }: DocsPageContext): string {
  const source = run ? `[DORA Metrics run ${run.id}](${run.url})` : 'local run';
  return `Generated ${generatedAt.toISOString()} from ${source}`;
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(1);
}

// A chart point is only a week the metric has data for: Mermaid's xychart cannot leave a gap, and no data
// must never be drawn as 0.
type ChartPoint = { week: WeeklySummary; value: number };

function pointsFor(weeks: WeeklySummary[], value: (week: WeeklySummary) => number | null) {
  return weeks.flatMap((week): ChartPoint[] => {
    const v = value(week);
    return v === null ? [] : [{ week, value: v }];
  });
}

// Labels are quoted: an unquoted 08-17 lexes as numbers in Mermaid's xychart grammar.
function renderChart(title: string, points: ChartPoint[], plot: (value: number) => string) {
  if (points.length === 0) {
    return [`### ${title}`, '', NO_DATA_IN_WEEKS, ''];
  }
  const labels = points.map(({ week }) => `"${week.periodStart.toISOString().slice(5, 10)}"`);
  return [
    `### ${title}`,
    '',
    '```mermaid',
    CHART_THEME,
    'xychart-beta',
    `  x-axis [${labels.join(', ')}]`,
    `  line [${points.map(({ value }) => plot(value)).join(', ')}]`,
    '```',
    '',
  ];
}

// One unit per chart so the points compare: days if any point would show in days on its own.
function renderDurationChart(title: string, points: ChartPoint[]) {
  if (points.length === 0) {
    return renderChart(`${title} (median)`, points, String);
  }
  const inDays = points.some(({ value }) => value >= DAYS_THRESHOLD_HOURS);
  const divisor = inDays ? HOURS_PER_DAY : 1;
  return renderChart(`${title} (median, ${inDays ? 'days' : 'hours'})`, points, (hours) =>
    (hours / divisor).toFixed(1),
  );
}

function formatMedian(summary: DurationSummary): string {
  return summary ? formatDuration(summary.medianHours) : NO_DATA;
}

function renderTrend(weeks: WeeklySummary[]): string[] {
  const rows = weeks.map((week) => {
    const rate =
      week.changeFailure.rate === null ? NO_DATA : `${formatPercent(week.changeFailure.rate)}%`;
    return `| ${formatDate(week.periodStart)} | ${week.deploymentCount} | ${formatMedian(week.leadTime)} | ${rate} | ${formatMedian(week.restoreTime)} |`;
  });
  return [
    `## Last ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`,
    '',
    ...renderChart(
      'Deployments per week',
      pointsFor(weeks, (week) => week.deploymentCount),
      String,
    ),
    ...renderDurationChart(
      'Lead time for changes',
      pointsFor(weeks, (week) => week.leadTime?.medianHours ?? null),
    ),
    ...renderChart(
      'Change failure rate (%)',
      pointsFor(weeks, (week) => week.changeFailure.rate),
      formatPercent,
    ),
    ...renderDurationChart(
      'Time to restore service',
      pointsFor(weeks, (week) => week.restoreTime?.medianHours ?? null),
    ),
    '| Week of | Deployments | Lead time (median) | Change failure rate | Time to restore (median) |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

// weeks are the settled weeks, oldest first; the newest is the headline.
export function renderDocsPage(weeks: WeeklySummary[], context: DocsPageContext): string {
  const summary = weeks[weeks.length - 1];
  const lastDay = new Date(summary.periodEnd.getTime() - MS_PER_DAY);
  return [
    '# DORA Metrics',
    '',
    'These numbers update weekly, after the Tuesday DORA Metrics run. They cover the week before last,',
    'so changes closed late in the week have time to deploy and incidents have time to close.',
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
    ...renderTrend(weeks),
    formatSource(context),
    '',
  ].join('\n');
}
