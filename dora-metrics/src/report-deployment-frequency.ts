import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './github/fetch-workflow-runs.js';
import { computeDeploymentFrequency } from './metrics/deployment-frequency.js';
import { writeCsv } from './output/write-csv.js';

const DEFAULT_OWNER = 'US-Trustee-Program';
const DEFAULT_REPO = 'Bankruptcy-Oversight-Support-Systems';
const DEFAULT_WORKFLOW_FILE_NAME = 'continuous-deployment.yml';
const DEFAULT_PERIOD_DAYS = 7;
const DEFAULT_LOOKBACK_DAYS = 90;
const MAIN_BRANCH = 'main';
const OUTPUT_PATH = 'data/deployment-frequency.csv';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveStartDate(): Date {
  const raw = process.env.DORA_START_DATE;
  if (raw) {
    const startDate = new Date(raw);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`Invalid DORA_START_DATE: ${raw}`);
    }
    return startDate;
  }
  return new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * MS_PER_DAY);
}

function resolvePeriodDays(): number {
  const raw = process.env.DORA_PERIOD_DAYS;
  return raw ? Number(raw) : DEFAULT_PERIOD_DAYS;
}

function resolveEnvVar(name: string, defaultValue: string): string {
  const raw = process.env[name];
  return raw ? raw : defaultValue;
}

async function main(): Promise<void> {
  const owner = resolveEnvVar('DORA_OWNER', DEFAULT_OWNER);
  const repo = resolveEnvVar('DORA_REPO', DEFAULT_REPO);
  const workflowFileName = resolveEnvVar('DORA_WORKFLOW_FILE_NAME', DEFAULT_WORKFLOW_FILE_NAME);
  const startDate = resolveStartDate();
  const periodDays = resolvePeriodDays();

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const runs = await fetchWorkflowRuns({
    octokit,
    owner,
    repo,
    workflowFileName,
    branch: MAIN_BRANCH,
    since: startDate,
  });

  const buckets = computeDeploymentFrequency(runs, { startDate, periodDays });

  await writeCsv(buckets, OUTPUT_PATH);

  const totalDeployments = buckets.reduce((sum, bucket) => sum + bucket.deploymentCount, 0);
  const totalDays = buckets.length * periodDays;
  const averagePerDay = totalDays > 0 ? totalDeployments / totalDays : 0;

  console.log(
    `Deployment Frequency: ${totalDeployments} successful deployment(s) across ${buckets.length} period(s) (${averagePerDay.toFixed(2)} deployments/day). Wrote ${OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
