import { Octokit } from '@octokit/rest';
import { WorkflowRun } from '../metrics/deployment-frequency.js';

const PER_PAGE = 100;

export type FetchWorkflowRunsParams = {
  octokit: Octokit;
  owner: string;
  repo: string;
  workflowFileName: string;
  branch: string;
  since: Date;
};

export async function fetchWorkflowRuns({
  octokit,
  owner,
  repo,
  workflowFileName,
  branch,
  since,
}: FetchWorkflowRunsParams): Promise<WorkflowRun[]> {
  const runs: WorkflowRun[] = [];
  let page = 1;
  let fetchedCount = 0;
  let totalCount = Infinity;

  while (fetchedCount < totalCount) {
    const response = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowFileName,
      per_page: PER_PAGE,
      page,
    });

    const { workflow_runs, total_count } = response.data;
    totalCount = total_count;

    if (workflow_runs.length === 0) {
      break;
    }

    let hitSinceBoundary = false;
    for (const run of workflow_runs) {
      if (new Date(run.created_at) < since) {
        hitSinceBoundary = true;
        break;
      }
      if (run.head_branch === branch && run.status === 'completed') {
        runs.push({ id: run.id, conclusion: run.conclusion, created_at: run.created_at });
      }
    }

    fetchedCount += workflow_runs.length;
    if (hitSinceBoundary) {
      break;
    }

    page += 1;
  }

  return runs;
}
