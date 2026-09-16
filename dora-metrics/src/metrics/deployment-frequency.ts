import { MS_PER_DAY, resolvePeriodWindows } from './period-window.js';

export type WorkflowRun = {
  id: number;
  conclusion: string | null;
  created_at: string;
};

export type PeriodBucket = {
  periodStart: string;
  periodEnd: string;
  deploymentCount: number;
  deploymentsPerDay: number;
};

export type ComputeDeploymentFrequencyOptions = {
  startDate: Date;
  periodDays: number;
  endDate?: Date;
};

export function computeDeploymentFrequency(
  runs: WorkflowRun[],
  options: ComputeDeploymentFrequencyOptions,
): PeriodBucket[] {
  const { endDate, periodDays, windows } = resolvePeriodWindows(
    options.startDate,
    options.periodDays,
    options.endDate,
  );

  const successfulRunTimestamps = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime());

  return windows.map(({ startMs, endMs, periodStart, periodEnd }) => {
    const deploymentCount = successfulRunTimestamps.filter(
      (timestamp) => timestamp >= startMs && timestamp < endMs && timestamp < endDate.getTime(),
    ).length;

    const elapsedDays = (Math.min(endMs, endDate.getTime()) - startMs) / MS_PER_DAY;
    const effectiveDays = elapsedDays > 0 ? elapsedDays : periodDays;

    return {
      periodStart,
      periodEnd,
      deploymentCount,
      deploymentsPerDay: deploymentCount / effectiveDays,
    };
  });
}
