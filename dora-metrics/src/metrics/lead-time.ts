import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';
import { mean, median, MS_PER_HOUR } from './stats.js';

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
      meanLeadTimeHours: mean(bucketLeadTimes),
      medianLeadTimeHours: median(bucketLeadTimes),
    };
  });

  return { perIssue, byPeriod };
}
