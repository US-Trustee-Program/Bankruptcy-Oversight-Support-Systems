import { describe, expect, test, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { fetchCompletedIssues } from './fetch-completed-issues.js';

function mockOctokit(pages: Array<unknown[]>) {
  const listForRepo = vi.fn();
  pages.forEach((page) => {
    listForRepo.mockResolvedValueOnce({ data: page });
  });
  const octokit = {
    rest: {
      issues: {
        listForRepo,
      },
    },
  } as unknown as Octokit;
  return { octokit, listForRepo };
}

describe('fetchCompletedIssues', () => {
  test('excludes pull requests, non-completed issues, and issues without a CAMS ticket label', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: 'CAMS-892' }],
          pull_request: { url: 'https://example.com/pr/1' },
        },
        {
          number: 2,
          state_reason: 'not_planned',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: 'CAMS-893' }],
        },
        {
          number: 3,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: 'enhancement' }],
        },
        {
          number: 4,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: 'CAMS-894' }],
        },
      ],
    ]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toEqual([{ number: 4, closed_at: '2026-01-05T00:00:00.000Z' }]);
  });

  test('excludes an issue whose closed_at predates since despite passing the updated_at-based API filter', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          state_reason: 'completed',
          closed_at: '2025-12-01T00:00:00.000Z',
          labels: [{ name: 'CAMS-800' }],
        },
      ],
    ]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toEqual([]);
  });

  test('handles both string-form and object-form labels', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: ['CAMS-100'],
        },
        {
          number: 2,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: 'CAMS-101' }],
        },
      ],
    ]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues.map((issue) => issue.number)).toEqual([1, 2]);
  });

  test('excludes an otherwise-qualifying issue that has no closed_at', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          state_reason: 'completed',
          closed_at: null,
          labels: [{ name: 'CAMS-200' }],
        },
      ],
    ]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toEqual([]);
  });

  test('excludes an issue whose only label has an empty name', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          state_reason: 'completed',
          closed_at: '2026-01-05T00:00:00.000Z',
          labels: [{ name: '' }],
        },
      ],
    ]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toEqual([]);
  });

  test('throws when since is an invalid Date', async () => {
    const { octokit } = mockOctokit([]);

    await expect(
      fetchCompletedIssues({
        octokit,
        owner: 'US-Trustee-Program',
        repo: 'Bankruptcy-Oversight-Support-Systems',
        since: new Date('not-a-date'),
      }),
    ).rejects.toThrow('since must be a valid Date');
  });

  test('paginates until a short page is returned', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      state_reason: 'completed',
      closed_at: '2026-01-05T00:00:00.000Z',
      labels: [{ name: `CAMS-${i + 1}` }],
    }));
    const shortPage = [
      {
        number: 101,
        state_reason: 'completed',
        closed_at: '2026-01-05T00:00:00.000Z',
        labels: [{ name: 'CAMS-101' }],
      },
    ];
    const { octokit, listForRepo } = mockOctokit([fullPage, shortPage]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toHaveLength(101);
    expect(listForRepo).toHaveBeenCalledTimes(2);
    expect(listForRepo).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }));
    expect(listForRepo).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
  });

  test('stops immediately when the first page is empty', async () => {
    const { octokit, listForRepo } = mockOctokit([[]]);

    const issues = await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(issues).toEqual([]);
    expect(listForRepo).toHaveBeenCalledTimes(1);
  });

  test('passes owner, repo, closed state, and since through to the API call', async () => {
    const { octokit, listForRepo } = mockOctokit([[]]);
    const since = new Date('2026-01-01T00:00:00.000Z');

    await fetchCompletedIssues({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since,
    });

    expect(listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'US-Trustee-Program',
        repo: 'Bankruptcy-Oversight-Support-Systems',
        state: 'closed',
        since: since.toISOString(),
        per_page: 100,
        page: 1,
      }),
    );
  });
});
