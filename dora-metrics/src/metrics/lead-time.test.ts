import { describe, expect, test } from 'vitest';
import { computeLeadTime, CompletedIssue } from './lead-time.js';
import { WorkflowRun } from './deployment-frequency.js';

describe('computeLeadTime', () => {
  test('correlates each issue with the next successful deploy after it closed', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const issues: CompletedIssue[] = [{ number: 1, closed_at: '2026-01-02T00:00:00.000Z' }];
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-03T00:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-05T00:00:00.000Z' },
    ];

    const { perIssue } = computeLeadTime(issues, runs, { startDate, periodDays: 7, endDate });

    expect(perIssue).toHaveLength(1);
    expect(perIssue[0]).toEqual({
      issueNumber: 1,
      closedAt: '2026-01-02T00:00:00.000Z',
      deployedAt: '2026-01-03T00:00:00.000Z',
      leadTimeHours: 24,
    });
  });

  test('excludes an issue from perIssue when no deploy ever follows it', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const issues: CompletedIssue[] = [{ number: 1, closed_at: '2026-01-10T00:00:00.000Z' }];
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];

    const { perIssue } = computeLeadTime(issues, runs, { startDate, periodDays: 7, endDate });

    expect(perIssue).toEqual([]);
  });

  test('never selects a non-success run even when it is temporally nearest', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const issues: CompletedIssue[] = [{ number: 1, closed_at: '2026-01-02T00:00:00.000Z' }];
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'failure', created_at: '2026-01-02T06:00:00.000Z' },
      { id: 2, conclusion: null, created_at: '2026-01-02T12:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-04T00:00:00.000Z' },
    ];

    const { perIssue } = computeLeadTime(issues, runs, { startDate, periodDays: 7, endDate });

    expect(perIssue).toHaveLength(1);
    expect(perIssue[0].deployedAt).toBe('2026-01-04T00:00:00.000Z');
  });

  test('computes mean and median lead time per bucket, including an even-count median', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    // Each issue's closed_at sits strictly before its own intended run and
    // strictly after every earlier run, so each pairs off independently with
    // lead times 10h, 20h, 30h, 40h -> mean 25h, median (20+30)/2 = 25h.
    const issues: CompletedIssue[] = [
      { number: 1, closed_at: '2026-01-01T00:00:00.000Z' }, // -> run at 10h, lead 10h
      { number: 2, closed_at: '2026-01-01T15:00:00.000Z' }, // -> run at 35h, lead 20h
      { number: 3, closed_at: '2026-01-02T16:00:00.000Z' }, // -> run at 70h, lead 30h
      { number: 4, closed_at: '2026-01-04T03:00:00.000Z' }, // -> run at 115h, lead 40h
    ];
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-01T10:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-02T11:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-03T22:00:00.000Z' },
      { id: 4, conclusion: 'success', created_at: '2026-01-05T19:00:00.000Z' },
    ];

    const { byPeriod } = computeLeadTime(issues, runs, { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0].issueCount).toBe(4);
    expect(byPeriod[0].meanLeadTimeHours).toBe(25);
    expect(byPeriod[0].medianLeadTimeHours).toBe(25);
  });

  test('an empty issues array still produces zero-count buckets across the requested range', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-22T00:00:00.000Z');

    const { byPeriod, perIssue } = computeLeadTime([], [], { startDate, periodDays: 7, endDate });

    expect(perIssue).toEqual([]);
    expect(byPeriod).toHaveLength(3);
    for (const bucket of byPeriod) {
      expect(bucket.issueCount).toBe(0);
      expect(bucket.meanLeadTimeHours).toBe(0);
      expect(bucket.medianLeadTimeHours).toBe(0);
    }
  });

  test('excludes an issue whose closedAt falls after endDate even when the nominal bucket window would include it', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-11T00:00:00.000Z'); // 10-day range, 7-day periods
    const issues: CompletedIssue[] = [
      { number: 1, closed_at: '2026-01-09T00:00:00.000Z' },
      // Falls after endDate (Jan 11) but before the nominal bucket end (Jan 15).
      { number: 2, closed_at: '2026-01-13T00:00:00.000Z' },
    ];
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-09T12:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-14T00:00:00.000Z' },
    ];

    const { byPeriod } = computeLeadTime(issues, runs, { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(2);
    expect(byPeriod[1].issueCount).toBe(1);
  });

  test('throws when periodDays is zero, negative, or not a finite number', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');

    expect(() => computeLeadTime([], [], { startDate, endDate, periodDays: 0 })).toThrow();
    expect(() => computeLeadTime([], [], { startDate, endDate, periodDays: -7 })).toThrow();
    expect(() => computeLeadTime([], [], { startDate, endDate, periodDays: NaN })).toThrow();
    expect(() => computeLeadTime([], [], { startDate, endDate, periodDays: Infinity })).toThrow();
  });

  test('throws when periodDays is a positive finite number too small to produce a bounded bucket count', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');

    expect(() =>
      computeLeadTime([], [], { startDate, endDate, periodDays: Number.MIN_VALUE }),
    ).toThrow('unbounded number of buckets');
  });

  test('throws when startDate or endDate is not a valid date', () => {
    const validStart = new Date('2026-01-01T00:00:00.000Z');
    const validEnd = new Date('2026-01-15T00:00:00.000Z');
    const invalid = new Date('not-a-date');

    expect(() =>
      computeLeadTime([], [], { startDate: invalid, endDate: validEnd, periodDays: 7 }),
    ).toThrow('startDate and endDate must be valid dates');
    expect(() =>
      computeLeadTime([], [], { startDate: validStart, endDate: invalid, periodDays: 7 }),
    ).toThrow('startDate and endDate must be valid dates');
  });

  test('throws when startDate is after endDate', () => {
    const startDate = new Date('2026-01-15T00:00:00.000Z');
    const endDate = new Date('2026-01-01T00:00:00.000Z');

    expect(() => computeLeadTime([], [], { startDate, endDate, periodDays: 7 })).toThrow(
      'startDate must be on or before endDate',
    );
  });
});
