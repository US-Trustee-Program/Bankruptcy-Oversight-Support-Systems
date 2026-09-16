import { describe, expect, test } from 'vitest';
import { computeMttr } from './mttr.js';
import { SeverityHighBug } from './change-failure-rate.js';
import { WorkflowRun } from './deployment-frequency.js';

describe('computeMttr', () => {
  test('an attributed, closed incident appears in perIncident with correct restoreTimeHours', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      {
        number: 1,
        created_at: '2026-01-02T06:00:00.000Z',
        closed_at: '2026-01-02T18:00:00.000Z',
      },
    ];

    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toHaveLength(1);
    expect(perIncident[0]).toEqual({
      issueNumber: 1,
      createdAt: '2026-01-02T06:00:00.000Z',
      closedAt: '2026-01-02T18:00:00.000Z',
      restoreTimeHours: 12,
    });
  });

  test('excludes an attributed but still-open incident (closed_at: null)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-02T06:00:00.000Z', closed_at: null },
    ];

    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toEqual([]);
  });

  test('excludes a severity:high bug that was never attributed to any deployment, even if closed', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      // Created more than 24h after the only deployment, so never attributed.
      {
        number: 1,
        created_at: '2026-01-05T00:00:00.000Z',
        closed_at: '2026-01-06T00:00:00.000Z',
      },
    ];

    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toEqual([]);
  });

  test('excludes an attributed incident whose created_at falls outside [startDate, endDate)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      // Falls just inside the window, deployed shortly before endDate.
      { id: 1, conclusion: 'success', created_at: '2026-01-07T20:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      // Created after endDate, but within 24h of the in-window deployment,
      // so attribution succeeds; the incident must still be excluded from
      // perIncident because its own created_at falls outside the window.
      {
        number: 1,
        created_at: '2026-01-08T10:00:00.000Z',
        closed_at: '2026-01-08T12:00:00.000Z',
      },
    ];

    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toEqual([]);
  });

  test('buckets an incident by created_at, not closed_at, when they fall in different periods', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-22T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' }, // period 0
    ];
    const bugIssues: SeverityHighBug[] = [
      {
        number: 1,
        created_at: '2026-01-02T06:00:00.000Z', // period 0
        closed_at: '2026-01-10T00:00:00.000Z', // period 1
      },
    ];

    const { byPeriod } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(3);
    expect(byPeriod[0].incidentCount).toBe(1);
    expect(byPeriod[1].incidentCount).toBe(0);
  });

  test('meanRestoreTimeHours and medianRestoreTimeHours are 0 for an empty bucket', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');

    const { byPeriod } = computeMttr([], [], { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0].incidentCount).toBe(0);
    expect(byPeriod[0].meanRestoreTimeHours).toBe(0);
    expect(byPeriod[0].medianRestoreTimeHours).toBe(0);
  });

  test('computes mean and median restore time across multiple incidents in a bucket', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-08T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' },
      { id: 2, conclusion: 'success', created_at: '2026-01-04T00:00:00.000Z' },
      { id: 3, conclusion: 'success', created_at: '2026-01-06T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      // 10h restore time
      {
        number: 1,
        created_at: '2026-01-02T06:00:00.000Z',
        closed_at: '2026-01-02T16:00:00.000Z',
      },
      // 20h restore time
      {
        number: 2,
        created_at: '2026-01-04T06:00:00.000Z',
        closed_at: '2026-01-05T02:00:00.000Z',
      },
      // 60h restore time
      {
        number: 3,
        created_at: '2026-01-06T06:00:00.000Z',
        closed_at: '2026-01-08T18:00:00.000Z',
      },
    ];

    const { byPeriod } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0].incidentCount).toBe(3);
    expect(byPeriod[0].meanRestoreTimeHours).toBe(30);
    expect(byPeriod[0].medianRestoreTimeHours).toBe(20);
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

      expect(() => computeMttr([], [], options)).toThrow(expected);
    },
  );
});
