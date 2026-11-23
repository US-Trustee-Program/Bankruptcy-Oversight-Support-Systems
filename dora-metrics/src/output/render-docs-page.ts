import type { DurationSummary, WeeklySummary } from '../metrics/weekly-summary.js';
import { MS_PER_DAY } from '../metrics/period-window.js';

const HOURS_PER_DAY = 24;
const DAYS_THRESHOLD_HOURS = 48;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NO_DATA = 'No data';
const NO_DATA_IN_WEEKS = 'No data in these weeks';
type ChartNotes = { empty: string; gaps: string };
const DATA_NOTES: ChartNotes = {
  empty: NO_DATA_IN_WEEKS,
  gaps: 'Weeks with no data are not plotted; see the table below.',
};
const RESTORE_NOTES: ChartNotes = {
  empty: 'No closed incidents in these weeks',
  gaps: 'Weeks without a closed incident are not plotted; see the table below.',
};
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

// Without a restore time, a week either had no incidents or has incidents still open.
function formatRestoreTime(week: WeeklySummary, format: (summary: DurationSummary) => string) {
  if (week.restoreTime) {
    return format(week.restoreTime);
  }
  const open = week.openIncidents;
  return open === 0
    ? 'No incidents'
    : `${open} ${open === 1 ? 'incident' : 'incidents'} still open`;
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
function renderChart(
  title: string,
  points: ChartPoint[],
  weekCount: number,
  plot: (value: number) => string,
  notes: ChartNotes = DATA_NOTES,
) {
  if (points.length === 0) {
    return [`### ${title}`, '', notes.empty, ''];
  }
  // Mermaid scales the y-axis to the data's own range by default, which makes small changes look huge.
  const top = Math.max(...points.map(({ value }) => value));
  const labels = points.map(({ week }) => `"${week.periodStart.toISOString().slice(5, 10)}"`);
  return [
    `### ${title}`,
    '',
    '```mermaid',
    CHART_THEME,
    'xychart-beta',
    `  x-axis [${labels.join(', ')}]`,
    `  y-axis 0 --> ${top > 0 ? plot(top) : '1'}`,
    // A one-point Mermaid line has zero length and draws nothing; a bar keeps the week visible.
    `  ${points.length === 1 ? 'bar' : 'line'} [${points.map(({ value }) => plot(value)).join(', ')}]`,
    '```',
    '',
    ...(points.length < weekCount ? [notes.gaps, ''] : []),
  ];
}

// One unit per chart so the points compare: days if any point would show in days on its own.
function renderDurationChart(
  title: string,
  points: ChartPoint[],
  weekCount: number,
  notes: ChartNotes = DATA_NOTES,
) {
  if (points.length === 0) {
    return renderChart(`${title} (median)`, points, weekCount, String, notes);
  }
  const inDays = points.some(({ value }) => value >= DAYS_THRESHOLD_HOURS);
  const divisor = inDays ? HOURS_PER_DAY : 1;
  return renderChart(
    `${title} (median, ${inDays ? 'days' : 'hours'})`,
    points,
    weekCount,
    (hours) => (hours / divisor).toFixed(1),
    notes,
  );
}

function formatMedian(summary: DurationSummary): string {
  return summary ? formatDuration(summary.medianHours) : NO_DATA;
}

function renderTrend(weeks: WeeklySummary[]): string[] {
  const rows = weeks.map((week) => {
    const rate =
      week.changeFailure.rate === null ? NO_DATA : `${formatPercent(week.changeFailure.rate)}%`;
    return `| ${formatDate(week.periodStart)} | ${week.deploymentCount} | ${formatMedian(week.leadTime)} | ${rate} | ${formatRestoreTime(week, formatMedian)} |`;
  });
  return [
    `## Last ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`,
    '',
    ...renderChart(
      'Deployments per week',
      pointsFor(weeks, (week) => week.deploymentCount),
      weeks.length,
      String,
    ),
    ...renderDurationChart(
      'Lead time for changes',
      pointsFor(weeks, (week) => week.leadTime?.medianHours ?? null),
      weeks.length,
    ),
    ...renderChart(
      'Change failure rate (%)',
      pointsFor(weeks, (week) => week.changeFailure.rate),
      weeks.length,
      formatPercent,
    ),
    ...renderDurationChart(
      'Time to restore service',
      pointsFor(weeks, (week) => week.restoreTime?.medianHours ?? null),
      weeks.length,
      RESTORE_NOTES,
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
    `| Time to restore service | ${formatRestoreTime(summary, formatDurationSummary)} |`,
    '',
    ...renderTrend(weeks),
    formatSource(context),
    '',
  ].join('\n');
}
