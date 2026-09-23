import { describe, expect, test } from 'vitest';
import { computeChangeFailureRate } from './change-failure-rate.js';
import { WorkflowRun } from './deployment-frequency.js';
import { SeverityHighBug } from './types.js';

describe('computeChangeFailureRate', () => {
  test('a deployment with zero qualifying bugs is not a change failure', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];

    const { perDeployment } = computeChangeFailureRate([], runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(1);
    expect(perDeployment[0].isChangeFailure).toBe(false);
  });

  test('changeFailureRate is 0, not NaN, for a bucket with zero deployments', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');

    const { byPeriod } = computeChangeFailureRate([], [], { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0].totalDeployments).toBe(0);
    expect(byPeriod[0].failedDeployments).toBe(0);
    expect(byPeriod[0].changeFailureRate).toBe(0);
  });

  test('a bug created after endDate but within 24h of an in-window deployment is still attributed', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-07T20:00:00.000Z' },
    ];
    // Created after endDate (Jan 8), but within 24h of the deployment above.
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-08T10:00:00.000Z', closed_at: null },
    ];

    const { perDeployment } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(1);
    expect(perDeployment[0].isChangeFailure).toBe(true);
    expect(perDeployment[0].attributedIssueNumber).toBe(1);
  });

  test('computes a fractional changeFailureRate across multiple deployments, sorting out-of-order input', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    // Runs supplied newest-first, as the GitHub API returns them, to exercise
    // the ascending sort of deploymentTimestamps.
    const runs: WorkflowRun[] = [
      { id: 2, conclusion: 'success', created_at: '2026-01-05T00:00:00.000Z' },
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      // Within 24h of the Jan 2 deployment only, not the Jan 5 one.
      { number: 1, created_at: '2026-01-02T12:00:00.000Z', closed_at: null },
    ];

    const { perDeployment, byPeriod } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(2);
    expect(perDeployment[0]).toEqual({
      deployedAt: '2026-01-02T00:00:00.000Z',
      isChangeFailure: true,
      attributedIssueNumber: 1,
    });
    expect(perDeployment[1]).toEqual({
      deployedAt: '2026-01-05T00:00:00.000Z',
      isChangeFailure: false,
      attributedIssueNumber: null,
    });
    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0].totalDeployments).toBe(2);
    expect(byPeriod[0].failedDeployments).toBe(1);
    expect(byPeriod[0].changeFailureRate).toBe(0.5);
  });

  test('splits deployments across different period buckets', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-22T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' }, // bucket 0
      { id: 2, conclusion: 'success', created_at: '2026-01-10T00:00:00.000Z' }, // bucket 1
    ];
    const bugIssues: SeverityHighBug[] = [
      // Within 24h of the bucket-1 deployment only.
      { number: 1, created_at: '2026-01-10T06:00:00.000Z', closed_at: null },
    ];

    const { byPeriod } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(byPeriod).toHaveLength(3);
    expect(byPeriod[0]).toEqual({
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-08T00:00:00.000Z',
      totalDeployments: 1,
      failedDeployments: 0,
      changeFailureRate: 0,
    });
    expect(byPeriod[1]).toEqual({
      periodStart: '2026-01-08T00:00:00.000Z',
      periodEnd: '2026-01-15T00:00:00.000Z',
      totalDeployments: 1,
      failedDeployments: 1,
      changeFailureRate: 1,
    });
    expect(byPeriod[2].totalDeployments).toBe(0);
  });

  test('excludes a non-success run from perDeployment', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
      { id: 2, conclusion: 'failure', created_at: '2026-01-03T00:00:00.000Z' },
    ];

    const { perDeployment } = computeChangeFailureRate([], runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(1);
    expect(perDeployment[0].deployedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  test('excludes deployments before startDate or at/after endDate', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2025-12-31T00:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-15T00:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-05T00:00:00.000Z' },
    ];

    const { perDeployment } = computeChangeFailureRate([], runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(1);
    expect(perDeployment[0].deployedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  test.each([
    {
      periodDays: 0,
      expected: 'periodDays must be a positive finite number, got 0',
    },
    {
      startDateOverride: 'invalid',
      expected: 'startDate and endDate must be valid dates',
    },
    {
      invertDates: true,
      expected: 'startDate must be on or before endDate',
    },
    {
      periodDays: Number.MIN_VALUE,
      expected: 'unbounded number of buckets',
    },
  ])(
    'propagates "$expected" from resolvePeriodWindows',
    ({ periodDays, startDateOverride, invertDates, expected }) => {
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const endDate = new Date('2026-01-15T00:00:00.000Z');

      const options = invertDates
        ? { startDate: endDate, endDate: startDate, periodDays: 7 }
        : {
            startDate: startDateOverride === 'invalid' ? new Date('not-a-date') : startDate,
            endDate,
            periodDays: periodDays ?? 7,
          };

      expect(() => computeChangeFailureRate([], [], options)).toThrow(expected);
    },
  );
});
