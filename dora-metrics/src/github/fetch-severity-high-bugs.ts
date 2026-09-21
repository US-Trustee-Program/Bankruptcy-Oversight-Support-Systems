import { Octokit } from '@octokit/rest';
import { SeverityHighBug } from '../metrics/types.js';

const PER_PAGE = 100;
const LABELS = 'bug,severity:high';

export type FetchSeverityHighBugsParams = {
  octokit: Octokit;
  owner: string;
  repo: string;
  since: Date;
};

type ListedIssue = Awaited<ReturnType<Octokit['rest']['issues']['listForRepo']>>['data'][number];

function toSeverityHighBug(issue: ListedIssue, sinceMs: number): SeverityHighBug | undefined {
  if ('pull_request' in issue && issue.pull_request) return undefined;
  if (new Date(issue.created_at).getTime() < sinceMs) return undefined;
  return { number: issue.number, created_at: issue.created_at, closed_at: issue.closed_at };
}

export async function fetchSeverityHighBugs({
  octokit,
  owner,
  repo,
  since,
}: FetchSeverityHighBugsParams): Promise<SeverityHighBug[]> {
  if (Number.isNaN(since.getTime())) {
    throw new Error('fetchSeverityHighBugs: since must be a valid Date');
  }

  const bugs: SeverityHighBug[] = [];
  let page = 1;

  for (;;) {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      labels: LABELS,
      since: since.toISOString(),
      per_page: PER_PAGE,
      page,
    });

    for (const issue of response.data) {
      const bug = toSeverityHighBug(issue, since.getTime());
      if (bug) bugs.push(bug);
    }

    if (response.data.length < PER_PAGE) break;
    page += 1;
  }

  return bugs;
}
