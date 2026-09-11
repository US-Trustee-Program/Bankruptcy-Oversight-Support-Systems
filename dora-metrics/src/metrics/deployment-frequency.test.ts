import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computeDeploymentFrequency, WorkflowRun } from './deployment-frequency.js';

describe('computeDeploymentFrequency', () => {
  test('buckets successful runs into fixed-width periods', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T12:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-03T00:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-09T00:00:00.000Z' },
    ];

    const buckets = computeDeploymentFrequency(runs, { startDate, periodDays: 7, endDate });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toEqual({
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-08T00:00:00.000Z',
      deploymentCount: 2,
      deploymentsPerDay: 2 / 7,
    });
    expect(buckets[1]).toEqual({
      periodStart: '2026-01-08T00:00:00.000Z',
      periodEnd: '2026-01-15T00:00:00.000Z',
      deploymentCount: 1,
      deploymentsPerDay: 1 / 7,
    });
  });

  test('a run falling exactly on a bucket edge belongs to the following period', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-08T00:00:00.000Z' },
    ];

    const buckets = computeDeploymentFrequency(runs, { startDate, periodDays: 7, endDate });

    expect(buckets[0].deploymentCount).toBe(0);
    expect(buckets[1].deploymentCount).toBe(1);
  });

  test('excludes runs whose conclusion is not success, even if present in input', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
      { id: 2, conclusion: 'failure', created_at: '2026-01-02T00:00:00.000Z' },
      { id: 3, conclusion: null, created_at: '2026-01-02T00:00:00.000Z' },
    ];

    const buckets = computeDeploymentFrequency(runs, { startDate, periodDays: 7, endDate });

    expect(buckets).toHaveLength(1);
    expect(buckets[0].deploymentCount).toBe(1);
  });

  test('produces a single zero-count bucket when the date range is zero-width', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    // No instant can be both >= startDate and < endDate when they're equal, so
    // even runs that land inside the nominal (but not yet elapsed) bucket window
    // correctly can't count toward a report with no elapsed time.
    const runs: WorkflowRun[] = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      conclusion: 'success' as const,
      created_at: '2026-01-02T00:00:00.000Z',
    }));

    const buckets = computeDeploymentFrequency(runs, {
      startDate,
      periodDays: 14,
      endDate: startDate,
    });

    expect(buckets).toHaveLength(1);
    expect(buckets[0].deploymentCount).toBe(0);
    expect(buckets[0].deploymentsPerDay).toBe(0);
  });

  test('throws when periodDays is zero, negative, or not a finite number', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');

    expect(() => computeDeploymentFrequency([], { startDate, endDate, periodDays: 0 })).toThrow();
    expect(() => computeDeploymentFrequency([], { startDate, endDate, periodDays: -7 })).toThrow();
    expect(() => computeDeploymentFrequency([], { startDate, endDate, periodDays: NaN })).toThrow();
    expect(() =>
      computeDeploymentFrequency([], { startDate, endDate, periodDays: Infinity }),
    ).toThrow();
  });

  test('throws when periodDays is a positive finite number too small to produce a bounded bucket count', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');

    expect(() =>
      computeDeploymentFrequency([], { startDate, endDate, periodDays: Number.MIN_VALUE }),
    ).toThrow('unbounded number of buckets');
  });

  test('rounds up to a partial final bucket when the range is not an exact multiple of periodDays', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-11T00:00:00.000Z'); // 10-day range, 7-day periods

    const buckets = computeDeploymentFrequency([], { startDate, endDate, periodDays: 7 });

    expect(buckets).toHaveLength(2);
    expect(buckets[1]).toEqual({
      periodStart: '2026-01-08T00:00:00.000Z',
      periodEnd: '2026-01-15T00:00:00.000Z', // extends 4 days past endDate
      deploymentCount: 0,
      deploymentsPerDay: 0,
    });
  });

  test('prorates the trailing bucket rate by its real elapsed days, not the nominal period length', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-11T00:00:00.000Z'); // 10-day range, 7-day periods
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-09T00:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-10T00:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-10T12:00:00.000Z' },
    ];

    const buckets = computeDeploymentFrequency(runs, { startDate, endDate, periodDays: 7 });

    expect(buckets).toHaveLength(2);
    // Trailing bucket nominally spans Jan 8-15, but only 3 days (Jan 8-11) actually
    // elapsed before endDate, so the rate should be 3 deployments / 3 days, not / 7.
    expect(buckets[1].deploymentCount).toBe(3);
    expect(buckets[1].deploymentsPerDay).toBe(1);
  });

  test('excludes a run that falls after endDate but within the nominal trailing bucket', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-11T00:00:00.000Z'); // 10-day range, 7-day periods
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-09T00:00:00.000Z' },
      // Falls after endDate (Jan 11) but before the nominal bucket end (Jan 15).
      { id: 2, conclusion: 'success', created_at: '2026-01-13T00:00:00.000Z' },
    ];

    const buckets = computeDeploymentFrequency(runs, { startDate, endDate, periodDays: 7 });

    expect(buckets[1].deploymentCount).toBe(1);
  });

  test('throws when startDate is after endDate', () => {
    const startDate = new Date('2026-01-15T00:00:00.000Z');
    const endDate = new Date('2026-01-01T00:00:00.000Z');

    expect(() => computeDeploymentFrequency([], { startDate, endDate, periodDays: 7 })).toThrow(
      'startDate must be on or before endDate',
    );
  });

  test('an empty input array produces zero-count buckets across the requested date range', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-22T00:00:00.000Z');

    const buckets = computeDeploymentFrequency([], { startDate, periodDays: 7, endDate });

    expect(buckets).toHaveLength(3);
    for (const bucket of buckets) {
      expect(bucket.deploymentCount).toBe(0);
      expect(bucket.deploymentsPerDay).toBe(0);
    }
  });

  describe('defaults endDate to now when not provided', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-08T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('buckets exactly up to the current time', () => {
      const startDate = new Date('2026-01-01T00:00:00.000Z');

      const buckets = computeDeploymentFrequency([], { startDate, periodDays: 7 });

      expect(buckets).toHaveLength(1);
      expect(buckets[0].periodEnd).toBe('2026-01-08T00:00:00.000Z');
    });
  });
});
