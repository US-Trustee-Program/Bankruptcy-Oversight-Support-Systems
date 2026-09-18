import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';
import { resolveDeploymentAttributions } from './change-failure-attribution.js';
import { mean, median, MS_PER_HOUR } from './stats.js';
import { SeverityHighBug } from './types.js';

type RestoredIncident = {
  issueNumber: number;
  createdAt: string;
  closedAt: string;
  restoreTimeHours: number;
};

type MttrBucket = {
  periodStart: string;
  periodEnd: string;
  incidentCount: number;
  meanRestoreTimeHours: number;
  medianRestoreTimeHours: number;
};

export type ComputeMttrOptions = {
  startDate: Date;
  periodDays: number;
  endDate?: Date;
};

export type ComputeMttrResult = {
  perIncident: RestoredIncident[];
  byPeriod: MttrBucket[];
};

export function computeMttr(
  bugIssues: SeverityHighBug[],
  runs: WorkflowRun[],
  options: ComputeMttrOptions,
): ComputeMttrResult {
  const { startDate, endDate, windows } = resolvePeriodWindows(
    options.startDate,
    options.periodDays,
    options.endDate,
  );

  const { attributions } = resolveDeploymentAttributions(bugIssues, runs, startDate, endDate);
  const attributedIssueNumbers = new Set(attributions.filter((n): n is number => n !== null));

  const perIncident: RestoredIncident[] = [];
  for (const bug of bugIssues) {
    if (!attributedIssueNumbers.has(bug.number)) continue;
    if (!bug.closed_at) continue;
    const createdAtMs = new Date(bug.created_at).getTime();
    // Every attributed bug's created_at is already > its deployment's timestamp,
    // which is itself >= startDate, so createdAtMs can never be < startDate here.
    if (createdAtMs >= endDate.getTime()) continue;
    const closedAtMs = new Date(bug.closed_at).getTime();
    if (closedAtMs < createdAtMs) continue; // defensive: anomalous data, skip rather than corrupt the aggregate
    perIncident.push({
      issueNumber: bug.number,
      createdAt: bug.created_at,
      closedAt: bug.closed_at,
      restoreTimeHours: (closedAtMs - createdAtMs) / MS_PER_HOUR,
    });
  }

  const byPeriod: MttrBucket[] = windows.map(({ startMs, endMs, periodStart, periodEnd }) => {
    const bucketRestoreTimes = perIncident
      .filter((incident) => {
        const t = new Date(incident.createdAt).getTime();
        return t >= startMs && t < endMs;
      })
      .map((incident) => incident.restoreTimeHours);

    return {
      periodStart,
      periodEnd,
      incidentCount: bucketRestoreTimes.length,
      meanRestoreTimeHours: mean(bucketRestoreTimes),
      medianRestoreTimeHours: median(bucketRestoreTimes),
    };
  });

  return { perIncident, byPeriod };
}
