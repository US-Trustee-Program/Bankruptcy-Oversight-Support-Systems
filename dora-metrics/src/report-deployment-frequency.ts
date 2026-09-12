import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './github/fetch-workflow-runs.js';
import { computeDeploymentFrequency } from './metrics/deployment-frequency.js';
import { writeCsv } from './output/write-csv.js';
import { resolveReportOptions } from './config/resolve-report-options.js';

const MAIN_BRANCH = 'main';
const OUTPUT_PATH = 'data/deployment-frequency.csv';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const { owner, repo, workflowFileName, startDate, periodDays, endDate } = resolveReportOptions();

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const runs = await fetchWorkflowRuns({
    octokit,
    owner,
    repo,
    workflowFileName,
    branch: MAIN_BRANCH,
    since: startDate,
  });

  const buckets = computeDeploymentFrequency(runs, { startDate, periodDays, endDate });

  const rows = buckets.map((bucket) => ({
    periodStart: bucket.periodStart,
    periodEnd: bucket.periodEnd,
    deploymentCount: bucket.deploymentCount,
    deploymentsPerDay: bucket.deploymentsPerDay.toFixed(2),
  }));
  await writeCsv(rows, OUTPUT_PATH);

  const totalDeployments = buckets.reduce((sum, bucket) => sum + bucket.deploymentCount, 0);
  const totalDays = (endDate.getTime() - startDate.getTime()) / MS_PER_DAY;
  const averagePerDay = totalDays > 0 ? totalDeployments / totalDays : 0;

  console.log(
    `Deployment Frequency: ${totalDeployments} successful deployment(s) across ${buckets.length} period(s) (${averagePerDay.toFixed(2)} deployments/day). Wrote ${OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
