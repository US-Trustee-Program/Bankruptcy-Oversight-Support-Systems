import { WorkflowRun } from './deployment-frequency.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
  const { startDate, periodDays } = options;
  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    throw new Error(`periodDays must be a positive finite number, got ${periodDays}`);
  }
  const endDate = options.endDate ?? new Date();
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new Error('startDate and endDate must be valid dates');
  }
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('startDate must be on or before endDate');
  }
  const periodMs = periodDays * MS_PER_DAY;
  const totalMs = endDate.getTime() - startDate.getTime();
  const periodCount = Math.max(1, Math.ceil(totalMs / periodMs));
  if (!Number.isFinite(periodCount)) {
    throw new Error(
      'periodDays is too small relative to the date range (would produce an unbounded number of buckets)',
    );
  }

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

  const byPeriod: LeadTimeBucket[] = [];
  for (let i = 0; i < periodCount; i++) {
    const bucketStartMs = startDate.getTime() + i * periodMs;
    const bucketEndMs = bucketStartMs + periodMs;

    const bucketLeadTimes = perIssue
      .filter((issue) => {
        const t = new Date(issue.closedAt).getTime();
        return t >= bucketStartMs && t < bucketEndMs;
      })
      .map((issue) => issue.leadTimeHours);

    byPeriod.push({
      periodStart: new Date(bucketStartMs).toISOString(),
      periodEnd: new Date(bucketEndMs).toISOString(),
      issueCount: bucketLeadTimes.length,
      meanLeadTimeHours:
        bucketLeadTimes.length > 0
          ? bucketLeadTimes.reduce((sum, v) => sum + v, 0) / bucketLeadTimes.length
          : 0,
      medianLeadTimeHours: median(bucketLeadTimes),
    });
  }

  return { perIssue, byPeriod };
}
