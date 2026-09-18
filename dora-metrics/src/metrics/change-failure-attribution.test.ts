import { describe, expect, test } from 'vitest';
import {
  attributeDeploymentsToBugs,
  AttributableBug,
  resolveDeploymentAttributions,
} from './change-failure-attribution.js';
import { WorkflowRun } from './deployment-frequency.js';

describe('attributeDeploymentsToBugs', () => {
  test('does not attribute a bug created exactly at the deployment boundary (exclusive lower bound)', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const bugs: AttributableBug[] = [
      { number: 1, createdAtMs: new Date('2026-01-02T00:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([deployedAtMs], bugs);

    expect(result).toEqual([null]);
  });

  test('attributes a bug created exactly 24h after the deployment (inclusive upper bound)', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const bugs: AttributableBug[] = [
      { number: 1, createdAtMs: new Date('2026-01-03T00:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([deployedAtMs], bugs);

    expect(result).toEqual([1]);
  });

  test('does not attribute a bug created 24h and 1ms after the deployment', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const bugs: AttributableBug[] = [
      { number: 1, createdAtMs: new Date('2026-01-03T00:00:00.001Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([deployedAtMs], bugs);

    expect(result).toEqual([null]);
  });

  test('attributes the earliest of multiple qualifying bugs in one deployment window', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const bugs: AttributableBug[] = [
      { number: 2, createdAtMs: new Date('2026-01-02T12:00:00.000Z').getTime() },
      { number: 1, createdAtMs: new Date('2026-01-02T06:00:00.000Z').getTime() },
      { number: 3, createdAtMs: new Date('2026-01-02T18:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([deployedAtMs], bugs);

    expect(result).toEqual([1]);
  });

  test('a bug is attributed to only the earliest of two deployments whose windows both cover it (no double attribution)', () => {
    const firstDeployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const secondDeployedAtMs = new Date('2026-01-02T06:00:00.000Z').getTime();
    // Falls within 24h of both deployments above.
    const bugs: AttributableBug[] = [
      { number: 1, createdAtMs: new Date('2026-01-02T03:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([firstDeployedAtMs, secondDeployedAtMs], bugs);

    expect(result).toEqual([1, null]);
  });

  test('when a bug is already claimed, a later overlapping deployment falls through to a different unclaimed bug', () => {
    const firstDeployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const secondDeployedAtMs = new Date('2026-01-02T06:00:00.000Z').getTime();
    const bugs: AttributableBug[] = [
      // Falls within 24h of both deployments; claimed by the first.
      { number: 1, createdAtMs: new Date('2026-01-02T03:00:00.000Z').getTime() },
      // Falls within 24h of the second deployment only.
      { number: 2, createdAtMs: new Date('2026-01-02T18:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([firstDeployedAtMs, secondDeployedAtMs], bugs);

    expect(result).toEqual([1, 2]);
  });

  test('returns one null per deployment when there are no bugs', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();

    const result = attributeDeploymentsToBugs([deployedAtMs], []);

    expect(result).toEqual([null]);
  });

  test('claims bugs in chronological deployment order and returns results in input order, even when input is unsorted', () => {
    const firstDeployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();
    const secondDeployedAtMs = new Date('2026-01-02T06:00:00.000Z').getTime();
    // Falls within 24h of both deployments; must be claimed by the chronologically
    // earlier one (first) even though it is passed second in the input array.
    const bugs: AttributableBug[] = [
      { number: 1, createdAtMs: new Date('2026-01-02T03:00:00.000Z').getTime() },
    ];

    const result = attributeDeploymentsToBugs([secondDeployedAtMs, firstDeployedAtMs], bugs);

    expect(result).toEqual([null, 1]);
  });
});

describe('resolveDeploymentAttributions', () => {
  test('excludes a successful run landing exactly at endDate (exclusive upper bound)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: endDate.toISOString() },
    ];

    const { deploymentTimestampsMs, attributions } = resolveDeploymentAttributions(
      [],
      runs,
      startDate,
      endDate,
    );

    expect(deploymentTimestampsMs).toEqual([]);
    expect(attributions).toEqual([]);
  });
});
