import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './github/fetch-workflow-runs.js';
import { fetchSeverityHighBugs } from './github/fetch-severity-high-bugs.js';
import { computeChangeFailureRate } from './metrics/change-failure-rate.js';
import { writeCsv } from './output/write-csv.js';
import { resolveReportOptions } from './config/resolve-report-options.js';

const DETAIL_OUTPUT_PATH = 'data/change-failure-detail.csv';
const BY_PERIOD_OUTPUT_PATH = 'data/change-failure-rate-by-period.csv';

async function main(): Promise<void> {
  const { owner, repo, workflowFileName, branch, startDate, periodDays, endDate } =
    resolveReportOptions();

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const [runs, bugIssues] = await Promise.all([
    fetchWorkflowRuns({ octokit, owner, repo, workflowFileName, branch, since: startDate }),
    fetchSeverityHighBugs({ octokit, owner, repo, since: startDate }),
  ]);

  const { perDeployment, byPeriod } = computeChangeFailureRate(bugIssues, runs, {
    startDate,
    periodDays,
    endDate,
  });

  await writeCsv(
    perDeployment.map((deployment) => ({
      deployedAt: deployment.deployedAt,
      isChangeFailure: deployment.isChangeFailure ? 'true' : 'false',
      attributedIssueNumber: deployment.attributedIssueNumber ?? '',
    })),
    DETAIL_OUTPUT_PATH,
    ['deployedAt', 'isChangeFailure', 'attributedIssueNumber'],
  );
  await writeCsv(
    byPeriod.map((bucket) => ({
      ...bucket,
      changeFailureRate: bucket.changeFailureRate.toFixed(4),
    })),
    BY_PERIOD_OUTPUT_PATH,
    ['periodStart', 'periodEnd', 'totalDeployments', 'failedDeployments', 'changeFailureRate'],
  );

  const totalDeployments = perDeployment.length;
  const failedDeployments = perDeployment.filter((d) => d.isChangeFailure).length;
  const overallRate = totalDeployments > 0 ? failedDeployments / totalDeployments : 0;

  console.log(
    `Change Failure Rate: ${failedDeployments}/${totalDeployments} deployment(s) attributed a change failure across ${byPeriod.length} period(s) (${(overallRate * 100).toFixed(1)}%). Wrote ${DETAIL_OUTPUT_PATH} and ${BY_PERIOD_OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
