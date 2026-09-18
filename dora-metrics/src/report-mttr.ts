import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './github/fetch-workflow-runs.js';
import { fetchSeverityHighBugs } from './github/fetch-severity-high-bugs.js';
import { computeMttr } from './metrics/mttr.js';
import { writeCsv } from './output/write-csv.js';
import { resolveReportOptions } from './config/resolve-report-options.js';
import { mean } from './metrics/stats.js';

const DETAIL_OUTPUT_PATH = 'data/mttr-detail.csv';
const BY_PERIOD_OUTPUT_PATH = 'data/mttr-by-period.csv';

async function main(): Promise<void> {
  const { owner, repo, workflowFileName, branch, startDate, periodDays, endDate } =
    resolveReportOptions();

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const [runs, bugIssues] = await Promise.all([
    fetchWorkflowRuns({ octokit, owner, repo, workflowFileName, branch, since: startDate }),
    fetchSeverityHighBugs({ octokit, owner, repo, since: startDate }),
  ]);

  const { perIncident, byPeriod } = computeMttr(bugIssues, runs, {
    startDate,
    periodDays,
    endDate,
  });

  await writeCsv(
    perIncident.map((incident) => ({
      ...incident,
      restoreTimeHours: incident.restoreTimeHours.toFixed(2),
    })),
    DETAIL_OUTPUT_PATH,
    ['issueNumber', 'createdAt', 'closedAt', 'restoreTimeHours'],
  );
  await writeCsv(
    byPeriod.map((bucket) => ({
      ...bucket,
      meanRestoreTimeHours: bucket.meanRestoreTimeHours.toFixed(2),
      medianRestoreTimeHours: bucket.medianRestoreTimeHours.toFixed(2),
    })),
    BY_PERIOD_OUTPUT_PATH,
    ['periodStart', 'periodEnd', 'incidentCount', 'meanRestoreTimeHours', 'medianRestoreTimeHours'],
  );

  const meanOverall = mean(perIncident.map((incident) => incident.restoreTimeHours));

  console.log(
    `Mean Time to Restore: ${perIncident.length} resolved incident(s) across ${byPeriod.length} period(s) (${meanOverall.toFixed(2)} mean hours). Wrote ${DETAIL_OUTPUT_PATH} and ${BY_PERIOD_OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
