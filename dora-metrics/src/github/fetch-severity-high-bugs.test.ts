import { describe, expect, test, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { fetchSeverityHighBugs } from './fetch-severity-high-bugs.js';

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

describe('fetchSeverityHighBugs', () => {
  test('excludes pull requests', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: null,
          pull_request: { url: 'https://example.com/pr/1' },
        },
        {
          number: 2,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: null,
        },
      ],
    ]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs.map((bug) => bug.number)).toEqual([2]);
  });

  test('excludes an issue whose created_at predates since despite passing the updated_at-based API filter', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          created_at: '2025-12-01T00:00:00.000Z',
          closed_at: null,
        },
      ],
    ]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs).toEqual([]);
  });

  test('includes an issue whose created_at exactly equals since (inclusive boundary)', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          closed_at: null,
        },
      ],
    ]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs.map((bug) => bug.number)).toEqual([1]);
  });

  test('includes an issue whose pull_request key is present but falsy (not a real PR)', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: null,
          pull_request: null,
        },
        {
          number: 2,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: null,
        },
      ],
    ]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs.map((bug) => bug.number)).toEqual([1, 2]);
  });

  test('includes both open and closed issues', async () => {
    const { octokit } = mockOctokit([
      [
        {
          number: 1,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: null,
        },
        {
          number: 2,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: '2026-01-06T00:00:00.000Z',
        },
      ],
    ]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs).toEqual([
      { number: 1, created_at: '2026-01-05T00:00:00.000Z', closed_at: null },
      { number: 2, created_at: '2026-01-05T00:00:00.000Z', closed_at: '2026-01-06T00:00:00.000Z' },
    ]);
  });

  test('throws when since is an invalid Date', async () => {
    const { octokit } = mockOctokit([]);

    await expect(
      fetchSeverityHighBugs({
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
      created_at: '2026-01-05T00:00:00.000Z',
      closed_at: null,
    }));
    const shortPage = [
      {
        number: 101,
        created_at: '2026-01-05T00:00:00.000Z',
        closed_at: null,
      },
    ];
    const { octokit, listForRepo } = mockOctokit([fullPage, shortPage]);

    const bugs = await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(bugs).toHaveLength(101);
    expect(listForRepo).toHaveBeenCalledTimes(2);
    expect(listForRepo).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }));
    expect(listForRepo).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
  });

  test('passes owner, repo, state all, the bug+severity:high label filter, and since through to the API call', async () => {
    const { octokit, listForRepo } = mockOctokit([[]]);
    const since = new Date('2026-01-01T00:00:00.000Z');

    await fetchSeverityHighBugs({
      octokit,
      owner: 'US-Trustee-Program',
      repo: 'Bankruptcy-Oversight-Support-Systems',
      since,
    });

    expect(listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'US-Trustee-Program',
        repo: 'Bankruptcy-Oversight-Support-Systems',
        state: 'all',
        labels: 'bug,severity:high',
        since: since.toISOString(),
        per_page: 100,
        page: 1,
      }),
    );
  });
});
