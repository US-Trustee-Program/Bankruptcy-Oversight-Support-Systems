import { describe, expect, test } from 'vitest';
import { computeMttr } from './mttr.js';
import { SeverityHighBug } from './types.js';
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

  test.each([
    {
      description: 'excludes an attributed but still-open incident (closed_at: null)',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-15T00:00:00.000Z'),
      runs: [{ id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' }],
      bugIssues: [{ number: 1, created_at: '2026-01-02T06:00:00.000Z', closed_at: null }],
    },
    {
      description:
        'excludes a severity:high bug that was never attributed to any deployment, even if closed',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-15T00:00:00.000Z'),
      runs: [{ id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' }],
      // Created more than 24h after the only deployment, so never attributed.
      bugIssues: [
        {
          number: 1,
          created_at: '2026-01-05T00:00:00.000Z',
          closed_at: '2026-01-06T00:00:00.000Z',
        },
      ],
    },
    {
      description:
        'excludes an attributed incident whose created_at falls outside [startDate, endDate)',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-08T00:00:00.000Z'),
      // Falls just inside the window, deployed shortly before endDate.
      runs: [{ id: 1, conclusion: 'success', created_at: '2026-01-07T20:00:00.000Z' }],
      // Created after endDate, but within 24h of the in-window deployment, so
      // attribution succeeds; the incident must still be excluded because its
      // own created_at falls outside the window.
      bugIssues: [
        {
          number: 1,
          created_at: '2026-01-08T10:00:00.000Z',
          closed_at: '2026-01-08T12:00:00.000Z',
        },
      ],
    },
    {
      description:
        'excludes an attributed, closed incident whose created_at equals endDate exactly (exclusive upper bound)',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-08T00:00:00.000Z'),
      runs: [{ id: 1, conclusion: 'success', created_at: '2026-01-07T20:00:00.000Z' }],
      bugIssues: [
        {
          number: 1,
          created_at: '2026-01-08T00:00:00.000Z',
          closed_at: '2026-01-08T06:00:00.000Z',
        },
      ],
    },
    {
      description:
        'excludes an attributed, closed incident whose closed_at precedes its created_at (anomalous data)',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-15T00:00:00.000Z'),
      runs: [{ id: 1, conclusion: 'success', created_at: '2026-01-02T00:00:00.000Z' }],
      bugIssues: [
        {
          number: 1,
          created_at: '2026-01-02T18:00:00.000Z',
          closed_at: '2026-01-02T06:00:00.000Z',
        },
      ],
    },
  ] satisfies {
    description: string;
    startDate: Date;
    endDate: Date;
    runs: WorkflowRun[];
    bugIssues: SeverityHighBug[];
  }[])('$description', ({ startDate, endDate, runs, bugIssues }) => {
    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toEqual([]);
  });

  test('excludes a non-success run from starting the attribution clock', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'failure', created_at: '2026-01-02T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      {
        number: 1,
        created_at: '2026-01-02T06:00:00.000Z',
        closed_at: '2026-01-02T18:00:00.000Z',
      },
    ];

    const { perIncident } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(perIncident).toEqual([]);
  });

  test('excludes a deployment before startDate from starting the attribution clock', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z');
    const runs: WorkflowRun[] = [
      // Falls before startDate, so cannot attribute the bug below even
      // though the bug is otherwise within its 24h attribution window.
      { id: 1, conclusion: 'success', created_at: '2025-12-31T00:00:00.000Z' },
    ];
    const bugIssues: SeverityHighBug[] = [
      // Within 24h of the excluded deployment, and itself inside
      // [startDate, endDate) — isolates the deployment-side window filter
      // from the incident-side one covered by the test above.
      {
        number: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        closed_at: '2026-01-01T06:00:00.000Z',
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

  test('buckets an incident created exactly on a period boundary into the later period (inclusive lower bound)', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-15T00:00:00.000Z'); // two 7-day periods
    const runs: WorkflowRun[] = [
      { id: 1, conclusion: 'success', created_at: '2026-01-07T20:00:00.000Z' }, // period 0
    ];
    const bugIssues: SeverityHighBug[] = [
      { number: 1, created_at: '2026-01-08T00:00:00.000Z', closed_at: '2026-01-08T06:00:00.000Z' }, // boundary
    ];

    const { byPeriod } = computeMttr(bugIssues, runs, { startDate, periodDays: 7, endDate });

    expect(byPeriod[0].incidentCount).toBe(0);
    expect(byPeriod[1].incidentCount).toBe(1);
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
