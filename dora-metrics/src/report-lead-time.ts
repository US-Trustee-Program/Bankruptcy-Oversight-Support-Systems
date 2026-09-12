import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './github/fetch-workflow-runs.js';
import { fetchCompletedIssues } from './github/fetch-completed-issues.js';
import { computeLeadTime } from './metrics/lead-time.js';
import { writeCsv } from './output/write-csv.js';
import { resolveReportOptions } from './config/resolve-report-options.js';

const MAIN_BRANCH = 'main';
const DETAIL_OUTPUT_PATH = 'data/lead-time-detail.csv';
const BY_PERIOD_OUTPUT_PATH = 'data/lead-time-by-period.csv';

async function main(): Promise<void> {
  const { owner, repo, workflowFileName, startDate, periodDays, endDate } = resolveReportOptions();

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const [runs, issues] = await Promise.all([
    fetchWorkflowRuns({
      octokit,
      owner,
      repo,
      workflowFileName,
      branch: MAIN_BRANCH,
      since: startDate,
    }),
    fetchCompletedIssues({ octokit, owner, repo, since: startDate }),
  ]);

  const { perIssue, byPeriod } = computeLeadTime(issues, runs, { startDate, periodDays, endDate });

  await writeCsv(
    perIssue.map((issue) => ({ ...issue, leadTimeHours: issue.leadTimeHours.toFixed(2) })),
    DETAIL_OUTPUT_PATH,
    ['issueNumber', 'closedAt', 'deployedAt', 'leadTimeHours'],
  );
  await writeCsv(
    byPeriod.map((bucket) => ({
      ...bucket,
      meanLeadTimeHours: bucket.meanLeadTimeHours.toFixed(2),
      medianLeadTimeHours: bucket.medianLeadTimeHours.toFixed(2),
    })),
    BY_PERIOD_OUTPUT_PATH,
  );

  const meanOverall =
    perIssue.length > 0
      ? perIssue.reduce((sum, issue) => sum + issue.leadTimeHours, 0) / perIssue.length
      : 0;

  console.log(
    `Lead Time for Changes: ${perIssue.length} issue(s) with a qualifying deployment across ${byPeriod.length} period(s) (${meanOverall.toFixed(2)} mean hours). Wrote ${DETAIL_OUTPUT_PATH} and ${BY_PERIOD_OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
