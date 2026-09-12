import { Octokit } from '@octokit/rest';
import { CompletedIssue } from '../metrics/lead-time.js';

const PER_PAGE = 100;
const TICKET_LABEL_PATTERN = /^CAMS-\d+$/;

export type FetchCompletedIssuesParams = {
  octokit: Octokit;
  owner: string;
  repo: string;
  since: Date;
};

type ListedIssue = Awaited<ReturnType<Octokit['rest']['issues']['listForRepo']>>['data'][number];

function hasTicketLabel(issue: ListedIssue): boolean {
  return issue.labels.some((label) => {
    const name = typeof label === 'string' ? label : label.name;
    return name ? TICKET_LABEL_PATTERN.test(name) : false;
  });
}

function toCompletedIssue(issue: ListedIssue, sinceMs: number): CompletedIssue | undefined {
  if ('pull_request' in issue && issue.pull_request) return undefined;
  if (issue.state_reason !== 'completed') return undefined;
  if (!issue.closed_at) return undefined;
  if (new Date(issue.closed_at).getTime() < sinceMs) return undefined;
  if (!hasTicketLabel(issue)) return undefined;
  return { number: issue.number, closed_at: issue.closed_at };
}

export async function fetchCompletedIssues({
  octokit,
  owner,
  repo,
  since,
}: FetchCompletedIssuesParams): Promise<CompletedIssue[]> {
  if (Number.isNaN(since.getTime())) {
    throw new Error('fetchCompletedIssues: since must be a valid Date');
  }

  const issues: CompletedIssue[] = [];
  let page = 1;

  for (;;) {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'closed',
      since: since.toISOString(),
      per_page: PER_PAGE,
      page,
    });

    if (response.data.length === 0) break;

    for (const issue of response.data) {
      const completedIssue = toCompletedIssue(issue, since.getTime());
      if (completedIssue) issues.push(completedIssue);
    }

    if (response.data.length < PER_PAGE) break;
    page += 1;
  }

  return issues;
}
