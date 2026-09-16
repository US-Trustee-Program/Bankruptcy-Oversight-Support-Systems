import { describe, expect, test } from 'vitest';
import { attributeDeploymentsToBugs, AttributableBug } from './change-failure-attribution.js';

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

  test('returns one null per deployment when there are no bugs', () => {
    const deployedAtMs = new Date('2026-01-02T00:00:00.000Z').getTime();

    const result = attributeDeploymentsToBugs([deployedAtMs], []);

    expect(result).toEqual([null]);
  });
});
