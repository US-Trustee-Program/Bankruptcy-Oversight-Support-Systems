// Shared K-lane fan-out pattern for dataflows that must bound concurrent downstream queries
// without relying on host.json queue settings (precedent: commit 5fbd22a29, CAMS-876 — fanning
// out all office groups as independent messages let Azure's own scale-out run far more
// concurrent queries than the downstream source could handle). Each lane becomes its own
// self-requeuing serial chain, so K lanes bound concurrency to K regardless of scale-out.

/**
 * Splits regions into laneCount fixed lists, assigned round-robin over sorted order (not a
 * contiguous split) so adjacent region IDs land in different lanes — workloads per region are
 * unequal, and round-robin spreads that unevenness across lanes rather than risking a
 * contiguous block of heavy regions landing in one lane. Deterministic and reproducible from
 * the region list alone, with no persisted lane-assignment state between runs.
 *
 * Always returns exactly laneCount arrays, including empty ones, so a caller that filters empty
 * lanes before use can still rely on the surviving arrays' original index as a stable lane id.
 */
export function assignLanesRoundRobin(regions: string[], laneCount: number): string[][] {
  const sorted = [...regions].sort();
  const lanes: string[][] = Array.from({ length: laneCount }, () => []);
  sorted.forEach((regionId, index) => {
    lanes[index % laneCount].push(regionId);
  });
  return lanes;
}

/**
 * A random integer in [minSeconds, maxSeconds] (inclusive), used to jitter a lane's first
 * message so K lanes don't all query the downstream source in the same instant at run start.
 */
export function pickJitterSeconds(minSeconds: number, maxSeconds: number): number {
  return minSeconds + Math.floor(Math.random() * (maxSeconds - minSeconds + 1));
}
