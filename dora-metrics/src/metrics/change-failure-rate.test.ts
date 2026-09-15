import { describe, expect, test } from 'vitest';
import { computeChangeFailureRate, SeverityHighBug } from './change-failure-rate.js';
import { WorkflowRun } from './deployment-frequency.js';

describe('computeChangeFailureRate', () => {
  test('does not attribute a bug created exactly at the deployment boundary (exclusive lower bound)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-02T00:00:00.000Z', closed_at: null },
    ];

    const { perDeployment } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment).toHaveLength(1);
    expect(perDeployment[0].isChangeFailure).toBe(false);
    expect(perDeployment[0].attributedIssueNumber).toBeNull();
  });

  test('attributes a bug created exactly 24h after the deployment (inclusive upper bound)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-03T00:00:00.000Z', closed_at: null },
    ];

    const { perDeployment } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment[0].isChangeFailure).toBe(true);
    expect(perDeployment[0].attributedIssueNumber).toBe(1);
  });

  test('does not attribute a bug created 24h and 1ms after the deployment', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-03T00:00:00.001Z', closed_at: null },
    ];

    const { perDeployment } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment[0].isChangeFailure).toBe(false);
    expect(perDeployment[0].attributedIssueNumber).toBeNull();
  });

  test('attributes the earliest of multiple qualifying bugs in one deployment window', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 2, created_at: '2026-01-02T12:00:00.000Z', closed_at: null },
      { number: 1, created_at: '2026-01-02T06:00:00.000Z', closed_at: null },
      { number: 3, created_at: '2026-01-02T18:00:00.000Z', closed_at: null },
    ];

    const { perDeployment } = computeChangeFailureRate(bugIssues, runs, {
      startDate,
      periodDays: 7,
      endDate,
    });

    expect(perDeployment[0].attributedIssueNumber).toBe(1);
  });

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

  test('propagates errors from resolvePeriodWindows for invalid input', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const invalid = new Date('not-a-date');

    expect(() => computeChangeFailureRate([], [], { startDate, endDate, periodDays: 0 })).toThrow(
      'periodDays must be a positive finite number, got 0',
    );
    expect(() =>
      computeChangeFailureRate([], [], { startDate: invalid, endDate, periodDays: 7 }),
    ).toThrow('startDate and endDate must be valid dates');
    expect(() =>
      computeChangeFailureRate([], [], { startDate: endDate, endDate: startDate, periodDays: 7 }),
    ).toThrow('startDate must be on or before endDate');
    expect(() =>
      computeChangeFailureRate([], [], { startDate, endDate, periodDays: Number.MIN_VALUE }),
    ).toThrow('unbounded number of buckets');
  });
});
