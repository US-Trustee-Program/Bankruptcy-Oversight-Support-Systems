import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';

const MS_PER_HOUR = 60 * 60 * 1000;

export type CompletedIssue = {
  number: number;
  closed_at: string;
};

type IssueLeadTime = {
  issueNumber: number;
  closedAt: string;
  deployedAt: string;
  leadTimeHours: number;
};

type LeadTimeBucket = {
  periodStart: string;
  periodEnd: string;
  issueCount: number;
  meanLeadTimeHours: number;
  medianLeadTimeHours: number;
};

export type ComputeLeadTimeOptions = {
  startDate: Date;
  periodDays: number;
  endDate?: Date;
};

export type ComputeLeadTimeResult = {
  perIssue: IssueLeadTime[];
  byPeriod: LeadTimeBucket[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeLeadTime(
  issues: CompletedIssue[],
  runs: WorkflowRun[],
  options: ComputeLeadTimeOptions,
): ComputeLeadTimeResult {
  const { startDate, endDate, windows } = resolvePeriodWindows(
    options.startDate,
    options.periodDays,
    options.endDate,
  );

  const successfulRunTimestamps = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime())
    .sort((a, b) => a - b);

  const perIssue: IssueLeadTime[] = [];
  for (const issue of issues) {
    const closedAtMs = new Date(issue.closed_at).getTime();
    if (closedAtMs < startDate.getTime() || closedAtMs >= endDate.getTime()) continue;
    const deployedAtMs = successfulRunTimestamps.find((t) => t > closedAtMs);
    if (deployedAtMs === undefined) continue;
    perIssue.push({
      issueNumber: issue.number,
      closedAt: issue.closed_at,
      deployedAt: new Date(deployedAtMs).toISOString(),
      leadTimeHours: (deployedAtMs - closedAtMs) / MS_PER_HOUR,
    });
  }

  const byPeriod: LeadTimeBucket[] = windows.map(({ startMs, endMs, periodStart, periodEnd }) => {
    const bucketLeadTimes = perIssue
      .filter((issue) => {
        const t = new Date(issue.closedAt).getTime();
        return t >= startMs && t < endMs;
      })
      .map((issue) => issue.leadTimeHours);

    return {
      periodStart,
      periodEnd,
      issueCount: bucketLeadTimes.length,
      meanLeadTimeHours:
        bucketLeadTimes.length > 0
          ? bucketLeadTimes.reduce((sum, v) => sum + v, 0) / bucketLeadTimes.length
          : 0,
      medianLeadTimeHours: median(bucketLeadTimes),
    };
  });

  return { perIssue, byPeriod };
}
