import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';
import { attributeDeploymentsToBugs } from './change-failure-attribution.js';
import { median } from './stats.js';
import { SeverityHighBug } from './change-failure-rate.js';

const MS_PER_HOUR = 60 * 60 * 1000;

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

  const deploymentTimestamps = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime())
    .filter((t) => t >= startDate.getTime() && t < endDate.getTime())
    .sort((a, b) => a - b);

  const bugs = bugIssues.map((bug) => ({
    number: bug.number,
    createdAtMs: new Date(bug.created_at).getTime(),
  }));
  const attributions = attributeDeploymentsToBugs(deploymentTimestamps, bugs);
  const attributedIssueNumbers = new Set(attributions.filter((n): n is number => n !== null));

  const perIncident: RestoredIncident[] = [];
  for (const bug of bugIssues) {
    if (!attributedIssueNumbers.has(bug.number)) continue;
    if (!bug.closed_at) continue;
    const createdAtMs = new Date(bug.created_at).getTime();
    if (createdAtMs < startDate.getTime() || createdAtMs >= endDate.getTime()) continue;
    const closedAtMs = new Date(bug.closed_at).getTime();
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
      meanRestoreTimeHours:
        bucketRestoreTimes.length > 0
          ? bucketRestoreTimes.reduce((sum, v) => sum + v, 0) / bucketRestoreTimes.length
          : 0,
      medianRestoreTimeHours: median(bucketRestoreTimes),
    };
  });

  return { perIncident, byPeriod };
}
