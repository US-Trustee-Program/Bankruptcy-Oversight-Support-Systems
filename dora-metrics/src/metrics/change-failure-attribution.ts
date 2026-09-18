import { WorkflowRun } from './deployment-frequency.js';
import { MS_PER_HOUR } from './stats.js';

const ATTRIBUTION_WINDOW_MS = 24 * MS_PER_HOUR;

export type AttributableBug = {
  number: number;
  createdAtMs: number;
};

// The earliest qualifying deployment claims a bug; later deployments within the
// same window cannot re-attribute it (this ordering is what fixes the
// double-attribution bug from PR #2983's review). Input order of
// deploymentTimestampsMs does not matter — deployments are always claimed in
// chronological order internally. Returns one entry per input deployment
// timestamp, in the same order as the input: the attributed bug's issue
// number, or null.
export function attributeDeploymentsToBugs(
  deploymentTimestampsMs: number[],
  bugs: AttributableBug[],
): (number | null)[] {
  const bugsByCreatedAt = [...bugs].sort((a, b) => a.createdAtMs - b.createdAtMs);
  const attributedBugNumbers = new Set<number>();

  const byChronologicalOrder = deploymentTimestampsMs
    .map((deployedAtMs, index) => ({ deployedAtMs, index }))
    .sort((a, b) => a.deployedAtMs - b.deployedAtMs);

  const results: (number | null)[] = new Array(deploymentTimestampsMs.length).fill(null);
  for (const { deployedAtMs, index } of byChronologicalOrder) {
    const windowEndMs = deployedAtMs + ATTRIBUTION_WINDOW_MS;
    const match = bugsByCreatedAt.find(
      (bug) =>
        !attributedBugNumbers.has(bug.number) &&
        bug.createdAtMs > deployedAtMs &&
        bug.createdAtMs <= windowEndMs,
    );
    if (match) attributedBugNumbers.add(match.number);
    results[index] = match ? match.number : null;
  }

  return results;
}

export type ResolvedDeploymentAttributions = {
  deploymentTimestampsMs: number[];
  attributions: (number | null)[];
};

// Shared by every DORA metric that attributes deployments to severity-high bugs
// (change failure rate, MTTR), so the "success in [startDate, endDate)" rule
// can't drift between them.
export function resolveDeploymentAttributions(
  bugIssues: { number: number; created_at: string }[],
  runs: WorkflowRun[],
  startDate: Date,
  endDate: Date,
): ResolvedDeploymentAttributions {
  const deploymentTimestampsMs = runs
    .filter((run) => run.conclusion === 'success')
    .map((run) => new Date(run.created_at).getTime())
    .filter((t) => t >= startDate.getTime() && t < endDate.getTime())
    .sort((a, b) => a - b);

  const bugs = bugIssues.map((bug) => ({
    number: bug.number,
    createdAtMs: new Date(bug.created_at).getTime(),
  }));
  const attributions = attributeDeploymentsToBugs(deploymentTimestampsMs, bugs);

  return { deploymentTimestampsMs, attributions };
}
