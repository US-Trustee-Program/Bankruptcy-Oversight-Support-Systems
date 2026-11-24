import type { CsvRow } from '../output/read-csv.js';
import { MS_PER_DAY } from './period-window.js';

// The four by-period CSVs the weekly summary is built from. Detail CSVs are deliberately
// excluded: they hold issue text, and the summary is rendered onto a public page.
export const BY_PERIOD_REPORTS = {
  deploymentFrequency: {
    file: 'deployment-frequency.csv',
    columns: ['periodStart', 'periodEnd', 'deploymentCount', 'deploymentsPerDay'],
  },
  leadTime: {
    file: 'lead-time-by-period.csv',
    columns: ['periodStart', 'periodEnd', 'issueCount', 'meanLeadTimeHours', 'medianLeadTimeHours'],
  },
  changeFailureRate: {
    file: 'change-failure-rate-by-period.csv',
    columns: [
      'periodStart',
      'periodEnd',
      'totalDeployments',
      'failedDeployments',
      'changeFailureRate',
    ],
  },
  mttr: {
    file: 'mttr-by-period.csv',
    columns: [
      'periodStart',
      'periodEnd',
      'incidentCount',
      'meanRestoreTimeHours',
      'medianRestoreTimeHours',
      'openIncidentCount',
    ],
  },
} as const;

type ReportKey = keyof typeof BY_PERIOD_REPORTS;

export type ByPeriodReports = Record<ReportKey, CsvRow[]>;

// null means nothing was measured that week (zero issues or incidents), which is not the same as zero hours.
export type DurationSummary = { medianHours: number; meanHours: number } | null;

export type WeeklySummary = {
  periodStart: Date;
  periodEnd: Date;
  deploymentCount: number;
  deploymentsPerDay: number;
  leadTime: DurationSummary;
  // rate is null when there were no deployments; 0 when deployments happened and none failed.
  changeFailure: { failedDeployments: number; totalDeployments: number; rate: number | null };
  restoreTime: DurationSummary;
  // Incidents that week not yet closed; with a null restoreTime, tells "still open" from "no incidents".
  openIncidents: number;
};

// A week is shown only once it ended at least this long ago. Lead time skips issues not yet deployed,
// and time to restore skips incidents not yet closed, so a just-ended week reads too fast.
const SETTLING_MS = 7 * MS_PER_DAY;

// The report scripts write by-period rows oldest first, so the settled rows come back oldest first too.
function rowsEndingBy(key: ReportKey, rows: CsvRow[], cutoff: Date): CsvRow[] {
  const settled = rows.filter((row) => new Date(row.periodEnd).getTime() <= cutoff.getTime());
  if (settled.length === 0) {
    throw new Error(
      `${BY_PERIOD_REPORTS[key].file} has no week ending at or before ${cutoff.toISOString()}`,
    );
  }
  return settled;
}

function numberFrom(key: ReportKey, row: CsvRow, column: string): number {
  const raw = row[column];
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value)) {
    throw new Error(`${BY_PERIOD_REPORTS[key].file}: ${column} is not a number: "${raw}"`);
  }
  return value;
}

function weekLabel(row: CsvRow | undefined): string {
  return row ? `${row.periodStart}–${row.periodEnd}` : 'no week';
}

// Every report must list the same settled weeks, so each summary combines rows for one week.
function assertSameWeeks(settled: Record<ReportKey, CsvRow[]>): void {
  const reference = settled.deploymentFrequency;
  for (const key of Object.keys(settled) as ReportKey[]) {
    const rows = settled[key];
    for (let i = 0; i < Math.max(reference.length, rows.length); i++) {
      if (weekLabel(rows[i]) !== weekLabel(reference[i])) {
        throw new Error(
          `By-period reports disagree on the week: ${BY_PERIOD_REPORTS.deploymentFrequency.file} has ${weekLabel(reference[i])} but ${BY_PERIOD_REPORTS[key].file} has ${weekLabel(rows[i])}`,
        );
      }
    }
  }
}

function summarizeWeek(week: Record<ReportKey, CsvRow>): WeeklySummary {
  const { deploymentFrequency, leadTime, changeFailureRate, mttr } = week;
  const totalDeployments = numberFrom('changeFailureRate', changeFailureRate, 'totalDeployments');

  return {
    periodStart: new Date(deploymentFrequency.periodStart),
    periodEnd: new Date(deploymentFrequency.periodEnd),
    deploymentCount: numberFrom('deploymentFrequency', deploymentFrequency, 'deploymentCount'),
    deploymentsPerDay: numberFrom('deploymentFrequency', deploymentFrequency, 'deploymentsPerDay'),
    leadTime:
      numberFrom('leadTime', leadTime, 'issueCount') === 0
        ? null
        : {
            medianHours: numberFrom('leadTime', leadTime, 'medianLeadTimeHours'),
            meanHours: numberFrom('leadTime', leadTime, 'meanLeadTimeHours'),
          },
    changeFailure: {
      failedDeployments: numberFrom('changeFailureRate', changeFailureRate, 'failedDeployments'),
      totalDeployments,
      rate:
        totalDeployments === 0
          ? null
          : numberFrom('changeFailureRate', changeFailureRate, 'changeFailureRate'),
    },
    restoreTime:
      numberFrom('mttr', mttr, 'incidentCount') === 0
        ? null
        : {
            medianHours: numberFrom('mttr', mttr, 'medianRestoreTimeHours'),
            meanHours: numberFrom('mttr', mttr, 'meanRestoreTimeHours'),
          },
    openIncidents: numberFrom('mttr', mttr, 'openIncidentCount'),
  };
}

// Summarizes every week that ended at least a week before generatedAt, oldest first. On the Tuesday run
// the newest is the week before last.
export function summarizeSettledWeeks(
  reports: ByPeriodReports,
  generatedAt: Date,
): WeeklySummary[] {
  const cutoff = new Date(generatedAt.getTime() - SETTLING_MS);
  const keys = Object.keys(BY_PERIOD_REPORTS) as ReportKey[];
  const settled = Object.fromEntries(
    keys.map((key) => [key, rowsEndingBy(key, reports[key], cutoff)]),
  ) as Record<ReportKey, CsvRow[]>;

  assertSameWeeks(settled);

  return settled.deploymentFrequency.map((_, i) =>
    summarizeWeek(
      Object.fromEntries(keys.map((key) => [key, settled[key][i]])) as Record<ReportKey, CsvRow>,
    ),
  );
}
