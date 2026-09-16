const MS_PER_HOUR = 60 * 60 * 1000;
const ATTRIBUTION_WINDOW_MS = 24 * MS_PER_HOUR;

export type AttributableBug = {
  number: number;
  createdAtMs: number;
};

// deploymentTimestampsMs must be sorted ascending — the earliest qualifying
// deployment claims a bug; later deployments within the same window cannot
// re-attribute it (this ordering is what fixes the double-attribution bug
// from PR #2983's review — see dora-metrics.slice-3-implementation-notes.md).
// Returns one entry per input deployment timestamp, in the same order: the
// attributed bug's issue number, or null.
export function attributeDeploymentsToBugs(
  deploymentTimestampsMs: number[],
  bugs: AttributableBug[],
): (number | null)[] {
  const bugsByCreatedAt = [...bugs].sort((a, b) => a.createdAtMs - b.createdAtMs);
  const attributedBugNumbers = new Set<number>();

  return deploymentTimestampsMs.map((deployedAtMs) => {
    const windowEndMs = deployedAtMs + ATTRIBUTION_WINDOW_MS;
    const match = bugsByCreatedAt.find(
      (bug) =>
        !attributedBugNumbers.has(bug.number) &&
        bug.createdAtMs > deployedAtMs &&
        bug.createdAtMs <= windowEndMs,
    );
    if (match) attributedBugNumbers.add(match.number);
    return match ? match.number : null;
  });
}
