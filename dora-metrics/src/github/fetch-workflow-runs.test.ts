import { describe, expect, test, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { fetchWorkflowRuns } from './fetch-workflow-runs.js';

function mockOctokit(pages: Array<{ workflow_runs: unknown[]; total_count: number }>) {
  const listWorkflowRuns = vi.fn();
  pages.forEach((page) => {
    listWorkflowRuns.mockResolvedValueOnce({ data: page });
  });
  const octokit = {
    rest: {
      actions: {
        listWorkflowRuns,
      },
    },
  } as unknown as Octokit;
  return { octokit, listWorkflowRuns };
}

describe('fetchWorkflowRuns', () => {
  test('excludes runs not on the main branch and runs that are not completed', async () => {
    const { octokit, listWorkflowRuns } = mockOctokit([
      {
        total_count: 3,
        workflow_runs: [
          {
            id: 1,
            conclusion: 'success',
            created_at: '2026-01-05T00:00:00.000Z',
            head_branch: 'main',
            status: 'completed',
          },
          {
            id: 2,
            conclusion: 'success',
            created_at: '2026-01-05T00:00:00.000Z',
            head_branch: 'feature/foo',
            status: 'completed',
          },
          {
            id: 3,
            conclusion: null,
            created_at: '2026-01-05T00:00:00.000Z',
            head_branch: 'main',
            status: 'in_progress',
          },
        ],
      },
    ]);

    const runs = await fetchWorkflowRuns({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      workflowFileName: 'continuous-deployment.yml',
      branch: 'main',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(runs).toEqual([
      { id: 1, conclusion: 'success', created_at: '2026-01-05T00:00:00.000Z' },
    ]);
    expect(listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'US-Trustee-Program',
        repo: 'Bankruptcy-Oversight-Support-Systems',
        workflow_id: 'continuous-deployment.yml',
        per_page: 100,
        page: 1,
      }),
    );
  });

  test('paginates through multiple pages and stops once a run is older than since', async () => {
    const { octokit, listWorkflowRuns } = mockOctokit([
      {
        total_count: 3,
        workflow_runs: [
          {
            id: 1,
            conclusion: 'success',
            created_at: '2026-02-01T00:00:00.000Z',
            head_branch: 'main',
            status: 'completed',
          },
        ],
      },
      {
        total_count: 3,
        workflow_runs: [
          {
            id: 2,
            conclusion: 'success',
            created_at: '2026-01-15T00:00:00.000Z',
            head_branch: 'main',
            status: 'completed',
          },
          {
            id: 3,
            conclusion: 'success',
            created_at: '2025-12-01T00:00:00.000Z',
            head_branch: 'main',
            status: 'completed',
          },
        ],
      },
    ]);

    const runs = await fetchWorkflowRuns({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      workflowFileName: 'continuous-deployment.yml',
      branch: 'main',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(runs.map((run) => run.id)).toEqual([1, 2]);
    expect(listWorkflowRuns).toHaveBeenCalledTimes(2);
    expect(listWorkflowRuns).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }));
    expect(listWorkflowRuns).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
  });

  test('returns an empty array when there are no matching runs', async () => {
    const { octokit } = mockOctokit([{ total_count: 0, workflow_runs: [] }]);

    const runs = await fetchWorkflowRuns({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      workflowFileName: 'continuous-deployment.yml',
      branch: 'main',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(runs).toEqual([]);
  });
});
