import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const ATTRIBUTION_WINDOW_MS = 24 * MS_PER_HOUR;

export type SeverityHighBug = {
  number: number;
  created_at: string;
  // Not used by this metric; reserved for a future time-to-resolve/MTTR metric.
  closed_at: string | null;
};

type DeploymentFailure = {
  deployedAt: string;
  isChangeFailure: boolean;
  attributedIssueNumber: number | null;
};

type ChangeFailureBucket = {
  periodStart: string;
  periodEnd: string;
  totalDeployments: number;
  failedDeployments: number;
  changeFailureRate: number;
};

export type ComputeChangeFailureRateOptions = {
  startDate: Date;
  periodDays: number;
  endDate?: Date;
};

export type ComputeChangeFailureRateResult = {
  perDeployment: DeploymentFailure[];
  byPeriod: ChangeFailureBucket[];
};

export function computeChangeFailureRate(
  bugIssues: SeverityHighBug[],
  runs: WorkflowRun[],
  options: ComputeChangeFailureRateOptions,
): ComputeChangeFailureRateResult {
  const { startDate, endDate, windows } = resolvePeriodWindows(
    options.startDate,
    options.periodDays,
    options.endDate,
  );

  const bugsByCreatedAt = bugIssues
    .map((bug) => ({ number: bug.number, createdAtMs: new Date(bug.created_at).getTime() }))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const attributedBugNumbers = new Set<number>();

  // Deployments are processed in ascending deployedAtMs order below, so the
  // earliest qualifying deployment claims a bug; later deployments within the
  // same window cannot re-attribute it.
  function findAttributedIssue(deployedAtMs: number): number | null {
    const windowEndMs = deployedAtMs + ATTRIBUTION_WINDOW_MS;
    const match = bugsByCreatedAt.find(
      (bug) =>
        !attributedBugNumbers.has(bug.number) &&
        bug.createdAtMs > deployedAtMs &&
        bug.createdAtMs <= windowEndMs,
    );
    if (match) attributedBugNumbers.add(match.number);
    return match ? match.number : null;
  }

  const deploymentTimestamps = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime())
    .filter((t) => t >= startDate.getTime() && t < endDate.getTime())
    .sort((a, b) => a - b);

  const perDeployment: DeploymentFailure[] = deploymentTimestamps.map((deployedAtMs) => {
    const attributedIssueNumber = findAttributedIssue(deployedAtMs);
    return {
      deployedAt: new Date(deployedAtMs).toISOString(),
      isChangeFailure: attributedIssueNumber !== null,
      attributedIssueNumber,
    };
  });

  const byPeriod: ChangeFailureBucket[] = windows.map(
    ({ startMs, endMs, periodStart, periodEnd }) => {
      const deploymentsInBucket = perDeployment.filter((deployment) => {
        const t = new Date(deployment.deployedAt).getTime();
        return t >= startMs && t < endMs;
      });

      const totalDeployments = deploymentsInBucket.length;
      const failedDeployments = deploymentsInBucket.filter((d) => d.isChangeFailure).length;

      return {
        periodStart,
        periodEnd,
        totalDeployments,
        failedDeployments,
        changeFailureRate: totalDeployments > 0 ? failedDeployments / totalDeployments : 0,
      };
    },
  );

  return { perDeployment, byPeriod };
}
