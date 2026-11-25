import { describe, expect, test } from 'vitest';
import { combineHistory, type StoredRun } from './history.js';
import type { ByPeriodReports } from './weekly-summary.js';

// Mondays, 00:00 UTC.
const OCT_05 = '2026-10-05';
const OCT_12 = '2026-10-12';
const OCT_19 = '2026-10-19';
const OCT_26 = '2026-10-26';

type Period = { periodStart: string; periodEnd: string };

function week(monday: string): Period {
  const start = new Date(`${monday}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

// Rows for one period in all four reports; deploymentCount tells which run a week came from.
function rowsFor(period: Period, deploymentCount: number): ByPeriodReports {
  return {
    deploymentFrequency: [
      { ...period, deploymentCount: String(deploymentCount), deploymentsPerDay: '1.00' },
    ],
    leadTime: [{ ...period, issueCount: '0', meanLeadTimeHours: '0', medianLeadTimeHours: '0' }],
    changeFailureRate: [
      {
        ...period,
        totalDeployments: String(deploymentCount),
        failedDeployments: '0',
        changeFailureRate: '0',
      },
    ],
    mttr: [
      {
        ...period,
        incidentCount: '0',
        meanRestoreTimeHours: '0',
        medianRestoreTimeHours: '0',
        openIncidentCount: '0',
      },
    ],
  };
}

function reports(...weeks: [Period, number][]): ByPeriodReports {
  const all = weeks.map(([period, count]) => rowsFor(period, count));
  return {
    deploymentFrequency: all.flatMap((r) => r.deploymentFrequency),
    leadTime: all.flatMap((r) => r.leadTime),
    changeFailureRate: all.flatMap((r) => r.changeFailureRate),
    mttr: all.flatMap((r) => r.mttr),
  };
}

function storedRun(
  runDate: string,
  runId: number,
  runReports: Partial<ByPeriodReports>,
): StoredRun {
  return { runDate, runId, reports: runReports };
}

// Settles every week ending on or before 2026-11-03.
const CURRENT_GENERATED_AT = new Date('2026-11-10T12:00:00.000Z');

// The week's Monday (MM-DD) and the deployment count it was taken from, or null for a gap.
function shape(weeks: ReturnType<typeof combineHistory>) {
  return weeks.map(({ periodStart, summary }) => [
    periodStart.toISOString().slice(5, 10),
    summary?.deploymentCount ?? null,
  ]);
}

describe('combineHistory', () => {
  test('puts weeks from stored runs before the current run’s weeks, oldest first', () => {
    const stored = [storedRun('2026-10-27', 1, reports([week(OCT_05), 1], [week(OCT_12), 2]))];
    const current = reports([week(OCT_19), 3], [week(OCT_26), 4]);

    const weeks = combineHistory(stored, { reports: current, generatedAt: CURRENT_GENERATED_AT });

    expect(shape(weeks)).toEqual([
      ['10-05', 1],
      ['10-12', 2],
      ['10-19', 3],
      ['10-26', 4],
    ]);
  });

  test('builds each week with the same summary as the current-run page', () => {
    const [{ periodStart, summary }] = combineHistory([], {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(periodStart).toEqual(new Date('2026-10-26T00:00:00.000Z'));
    expect(summary).toEqual({
      periodStart: new Date('2026-10-26T00:00:00.000Z'),
      periodEnd: new Date('2026-11-02T00:00:00.000Z'),
      deploymentCount: 4,
      deploymentsPerDay: 1,
      leadTime: null,
      changeFailure: { failedDeployments: 0, totalDeployments: 4, rate: 0 },
      restoreTime: null,
      openIncidents: 0,
    });
  });

  test('takes a restated week from the run with the later folder date', () => {
    const stored = [
      storedRun('2026-10-27', 9, reports([week(OCT_05), 1])),
      storedRun('2026-10-28', 2, reports([week(OCT_05), 2])),
    ];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)[0]).toEqual(['10-05', 2]);
  });

  test('takes a restated week from the higher run id when two runs share a folder date', () => {
    const stored = [
      storedRun('2026-10-27', 2, reports([week(OCT_05), 2])),
      storedRun('2026-10-27', 1, reports([week(OCT_05), 1])),
    ];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)[0]).toEqual(['10-05', 2]);
  });

  test('takes a restated week from the current run over any stored run', () => {
    const stored = [storedRun('2026-11-09', 1, reports([week(OCT_26), 1]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([['10-26', 4]]);
  });

  test('drops rows that are not calendar weeks, such as the rolling 90-day windows of early runs', () => {
    const rolling = {
      periodStart: '2026-08-18T14:00:00.000Z',
      periodEnd: '2026-11-16T14:00:00.000Z',
    };
    const tuesdayWeek = {
      periodStart: '2026-10-06T00:00:00.000Z',
      periodEnd: '2026-10-13T00:00:00.000Z',
    };
    const stored = [storedRun('2026-11-16', 1, reports([rolling, 1], [tuesdayWeek, 2]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([['10-26', 4]]);
  });

  test('drops a week that had not settled at its run (ended less than 7 days before the folder date)', () => {
    // Settles weeks ending on or before 2026-10-13: OCT_05 only.
    const stored = [storedRun('2026-10-20', 1, reports([week(OCT_05), 1], [week(OCT_12), 99]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([
      ['10-05', 1],
      ['10-12', null],
      ['10-19', null],
      ['10-26', 4],
    ]);
  });

  test('takes a week unsettled in one run from a later run where it had settled', () => {
    const stored = [
      storedRun('2026-10-20', 1, reports([week(OCT_05), 1], [week(OCT_12), 99])),
      storedRun('2026-10-27', 2, reports([week(OCT_12), 2])),
    ];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_19), 3]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([
      ['10-05', 1],
      ['10-12', 2],
      ['10-19', 3],
    ]);
  });

  test('shows a week no run supplies as a gap, not as zero', () => {
    const stored = [storedRun('2026-10-27', 1, reports([week(OCT_05), 1]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_19), 3]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([
      ['10-05', 1],
      ['10-12', null],
      ['10-19', 3],
    ]);
  });

  test('takes nothing from a run folder missing one of the four files', () => {
    const { mttr: _, ...withoutMttr } = reports([week(OCT_05), 2]);
    const stored = [
      storedRun('2026-10-27', 1, reports([week(OCT_05), 1])),
      storedRun('2026-10-28', 2, withoutMttr),
    ];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_12), 3]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([
      ['10-05', 1],
      ['10-12', 3],
    ]);
  });

  test('takes a week from an older run when a newer run has it in only some of its files', () => {
    const newer = reports([week(OCT_05), 2]);
    newer.mttr = [];
    const stored = [
      storedRun('2026-10-27', 1, reports([week(OCT_05), 1])),
      storedRun('2026-10-28', 2, newer),
    ];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_12), 3]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)[0]).toEqual(['10-05', 1]);
  });

  test('reads an mttr week stored without an open incident count as unknown', () => {
    const older = reports([week(OCT_05), 1]);
    older.mttr = older.mttr.map(({ openIncidentCount: _, ...row }) => row);

    const [first] = combineHistory([storedRun('2026-10-27', 1, older)], {
      reports: reports([week(OCT_12), 3]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(first.summary?.openIncidents).toBeNull();
  });

  test.each([
    {
      shape: 'starting at 14:00',
      period: { periodStart: '2026-10-05T14:00:00.000Z', periodEnd: '2026-10-12T14:00:00.000Z' },
    },
    {
      shape: '8 days long',
      period: { periodStart: '2026-10-05T00:00:00.000Z', periodEnd: '2026-10-13T00:00:00.000Z' },
    },
  ])('drops a Monday row $shape, which is not a calendar week', ({ period }) => {
    const stored = [storedRun('2026-10-27', 1, reports([period, 1]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_26), 4]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([['10-26', 4]]);
  });

  test('keeps a week that ended exactly 7 days before the folder date', () => {
    // OCT_05 ends 2026-10-12, the cutoff for a run dated 2026-10-19.
    const stored = [storedRun('2026-10-19', 1, reports([week(OCT_05), 1]))];

    const weeks = combineHistory(stored, {
      reports: reports([week(OCT_12), 2]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)[0]).toEqual(['10-05', 1]);
  });

  test('leaves out a current-run week that ended less than 7 days before generatedAt', () => {
    const justEnded = week('2026-11-02'); // ends 2026-11-09, after the 2026-11-03 cutoff

    const weeks = combineHistory([], {
      reports: reports([week(OCT_26), 4], [justEnded, 5]),
      generatedAt: CURRENT_GENERATED_AT,
    });

    expect(shape(weeks)).toEqual([['10-26', 4]]);
  });

  test('returns no weeks when no run supplies any', () => {
    const empty = { deploymentFrequency: [], leadTime: [], changeFailureRate: [], mttr: [] };

    expect(combineHistory([], { reports: empty, generatedAt: CURRENT_GENERATED_AT })).toEqual([]);
  });
});
