const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  const { startDate, periodDays } = options;
  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    throw new Error(`periodDays must be a positive finite number, got ${periodDays}`);
  }
  const endDate = options.endDate ?? new Date();
  const periodMs = periodDays * MS_PER_DAY;
  const totalMs = endDate.getTime() - startDate.getTime();
  const periodCount = Math.max(1, Math.ceil(totalMs / periodMs));

  const successfulRunTimestamps = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime());

  const buckets: PeriodBucket[] = [];
  for (let i = 0; i < periodCount; i++) {
    const bucketStartMs = startDate.getTime() + i * periodMs;
    const bucketEndMs = bucketStartMs + periodMs;

    const deploymentCount = successfulRunTimestamps.filter(
      (timestamp) => timestamp >= bucketStartMs && timestamp < bucketEndMs,
    ).length;

    buckets.push({
      periodStart: new Date(bucketStartMs).toISOString(),
      periodEnd: new Date(bucketEndMs).toISOString(),
      deploymentCount,
      deploymentsPerDay: deploymentCount / periodDays,
    });
  }

  return buckets;
}
