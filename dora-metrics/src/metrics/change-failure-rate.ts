import { WorkflowRun } from './deployment-frequency.js';
import { resolvePeriodWindows } from './period-window.js';
import { attributeDeploymentsToBugs } from './change-failure-attribution.js';

export type SeverityHighBug = {
  number: number;
  created_at: string;
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

  const perDeployment: DeploymentFailure[] = deploymentTimestamps.map((deployedAtMs, i) => ({
    deployedAt: new Date(deployedAtMs).toISOString(),
    isChangeFailure: attributions[i] !== null,
    attributedIssueNumber: attributions[i],
  }));

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
