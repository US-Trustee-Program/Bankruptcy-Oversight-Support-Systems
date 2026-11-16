import type { CsvRow } from '../output/read-csv.js';

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
};

// The report scripts write by-period rows oldest first, so the last eligible row is the latest week.
function latestRowEndingBy(key: ReportKey, rows: CsvRow[], generatedAt: Date): CsvRow {
  const eligible = rows.filter((row) => new Date(row.periodEnd).getTime() <= generatedAt.getTime());
  const latest: CsvRow | undefined = eligible[eligible.length - 1];
  if (!latest) {
    throw new Error(
      `${BY_PERIOD_REPORTS[key].file} has no week ending at or before ${generatedAt.toISOString()}`,
    );
  }
  return latest;
}

function numberFrom(key: ReportKey, row: CsvRow, column: string): number {
  const raw = row[column];
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value)) {
    throw new Error(`${BY_PERIOD_REPORTS[key].file}: ${column} is not a number: "${raw}"`);
  }
  return value;
}

function weekLabel(row: CsvRow): string {
  return `${row.periodStart}–${row.periodEnd}`;
}

export function summarizeLatestWeek(reports: ByPeriodReports, generatedAt: Date): WeeklySummary {
  const keys = Object.keys(BY_PERIOD_REPORTS) as ReportKey[];
  const latest = Object.fromEntries(
    keys.map((key) => [key, latestRowEndingBy(key, reports[key], generatedAt)]),
  ) as Record<ReportKey, CsvRow>;

  const reference = latest.deploymentFrequency;
  for (const key of keys) {
    if (weekLabel(latest[key]) !== weekLabel(reference)) {
      throw new Error(
        `By-period reports disagree on the latest week: ${BY_PERIOD_REPORTS.deploymentFrequency.file} has ${weekLabel(reference)} but ${BY_PERIOD_REPORTS[key].file} has ${weekLabel(latest[key])}`,
      );
    }
  }

  const { deploymentFrequency, leadTime, changeFailureRate, mttr } = latest;
  const totalDeployments = numberFrom('changeFailureRate', changeFailureRate, 'totalDeployments');

  return {
    periodStart: new Date(reference.periodStart),
    periodEnd: new Date(reference.periodEnd),
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
  };
}
