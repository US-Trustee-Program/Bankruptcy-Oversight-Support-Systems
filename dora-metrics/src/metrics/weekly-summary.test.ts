import { describe, expect, test } from 'vitest';
import { type ByPeriodReports, summarizeSettledWeeks } from './weekly-summary.js';

const WEEK_1 = { periodStart: '2026-10-26T00:00:00.000Z', periodEnd: '2026-11-02T00:00:00.000Z' };
const WEEK_2 = { periodStart: '2026-11-02T00:00:00.000Z', periodEnd: '2026-11-09T00:00:00.000Z' };
const WEEK_3 = { periodStart: '2026-11-09T00:00:00.000Z', periodEnd: '2026-11-16T00:00:00.000Z' };
const WEEK_4 = { periodStart: '2026-11-16T00:00:00.000Z', periodEnd: '2026-11-23T00:00:00.000Z' };

type Week = typeof WEEK_1;

function deploymentRow(week: Week, deploymentCount: number, deploymentsPerDay: string) {
  return { ...week, deploymentCount: String(deploymentCount), deploymentsPerDay };
}

function leadTimeRow(week: Week, issueCount: number, mean: string, median: string) {
  return {
    ...week,
    issueCount: String(issueCount),
    meanLeadTimeHours: mean,
    medianLeadTimeHours: median,
  };
}

function cfrRow(week: Week, total: number, failed: number, rate: string) {
  return {
    ...week,
    totalDeployments: String(total),
    failedDeployments: String(failed),
    changeFailureRate: rate,
  };
}

function mttrRow(
  week: Week,
  incidentCount: number,
  mean: string,
  median: string,
  openIncidentCount = 0,
) {
  return {
    ...week,
    incidentCount: String(incidentCount),
    meanRestoreTimeHours: mean,
    medianRestoreTimeHours: median,
    openIncidentCount: String(openIncidentCount),
  };
}

function reportsFor(week: Week, overrides: Partial<ByPeriodReports> = {}): ByPeriodReports {
  return {
    deploymentFrequency: [deploymentRow(week, 24, '3.43')],
    leadTime: [leadTimeRow(week, 5, '3.20', '3.60')],
    changeFailureRate: [cfrRow(week, 24, 2, '0.0833')],
    mttr: [mttrRow(week, 1, '300.25', '284.75')],
    ...overrides,
  };
}

const GENERATED_AT = new Date('2026-11-16T12:05:00.000Z');

describe('summarizeSettledWeeks', () => {
  test('summarizes every settled week oldest first, leaving out the week just ended', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [
        deploymentRow(WEEK_1, 10, '1.43'),
        deploymentRow(WEEK_2, 23, '3.29'),
        deploymentRow(WEEK_3, 14, '2.00'),
        deploymentRow(WEEK_4, 7, '1.00'),
      ],
      leadTime: [
        leadTimeRow(WEEK_1, 3, '1.00', '1.00'),
        leadTimeRow(WEEK_2, 5, '3.20', '3.60'),
        leadTimeRow(WEEK_3, 2, '6.50', '6.00'),
        leadTimeRow(WEEK_4, 1, '0.50', '0.50'),
      ],
      changeFailureRate: [
        cfrRow(WEEK_1, 10, 0, '0.0000'),
        cfrRow(WEEK_2, 24, 2, '0.0833'),
        cfrRow(WEEK_3, 14, 1, '0.0714'),
        cfrRow(WEEK_4, 7, 0, '0.0000'),
      ],
      mttr: [
        mttrRow(WEEK_1, 2, '10.00', '8.00'),
        mttrRow(WEEK_2, 1, '300.25', '284.75'),
        mttrRow(WEEK_3, 1, '4.00', '4.00'),
        mttrRow(WEEK_4, 0, '0.00', '0.00'),
      ],
    };

    // Tuesday 01:00 UTC run: WEEK_4 ended the day before, so it is still settling.
    const summaries = summarizeSettledWeeks(reports, new Date('2026-11-24T01:00:00.000Z'));

    expect(summaries).toEqual([
      {
        periodStart: new Date(WEEK_1.periodStart),
        periodEnd: new Date(WEEK_1.periodEnd),
        deploymentCount: 10,
        deploymentsPerDay: 1.43,
        leadTime: { medianHours: 1, meanHours: 1 },
        changeFailure: { failedDeployments: 0, totalDeployments: 10, rate: 0 },
        restoreTime: { medianHours: 8, meanHours: 10 },
        openIncidents: 0,
      },
      {
        periodStart: new Date(WEEK_2.periodStart),
        periodEnd: new Date(WEEK_2.periodEnd),
        deploymentCount: 23,
        deploymentsPerDay: 3.29,
        leadTime: { medianHours: 3.6, meanHours: 3.2 },
        changeFailure: { failedDeployments: 2, totalDeployments: 24, rate: 0.0833 },
        restoreTime: { medianHours: 284.75, meanHours: 300.25 },
        openIncidents: 0,
      },
      {
        periodStart: new Date(WEEK_3.periodStart),
        periodEnd: new Date(WEEK_3.periodEnd),
        deploymentCount: 14,
        deploymentsPerDay: 2,
        leadTime: { medianHours: 6, meanHours: 6.5 },
        changeFailure: { failedDeployments: 1, totalDeployments: 14, rate: 0.0714 },
        restoreTime: { medianHours: 4, meanHours: 4 },
        openIncidents: 0,
      },
    ]);
  });

  test('reports no data only for the week that had nothing to measure', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [
        deploymentRow(WEEK_1, 10, '1.43'),
        deploymentRow(WEEK_2, 0, '0.00'),
        deploymentRow(WEEK_3, 14, '2.00'),
      ],
      leadTime: [
        leadTimeRow(WEEK_1, 3, '1.00', '1.00'),
        leadTimeRow(WEEK_2, 0, '0.00', '0.00'),
        leadTimeRow(WEEK_3, 2, '6.50', '6.00'),
      ],
      changeFailureRate: [
        cfrRow(WEEK_1, 10, 0, '0.0000'),
        cfrRow(WEEK_2, 0, 0, '0.0000'),
        cfrRow(WEEK_3, 14, 1, '0.0714'),
      ],
      mttr: [
        mttrRow(WEEK_1, 2, '10.00', '8.00'),
        mttrRow(WEEK_2, 0, '0.00', '0.00'),
        mttrRow(WEEK_3, 1, '4.00', '4.00'),
      ],
    };

    const summaries = summarizeSettledWeeks(reports, new Date('2026-11-24T01:00:00.000Z'));

    expect(
      summaries.map((week) => [week.leadTime, week.changeFailure.rate, week.restoreTime]),
    ).toEqual([
      [{ medianHours: 1, meanHours: 1 }, 0, { medianHours: 8, meanHours: 10 }],
      [null, null, null],
      [{ medianHours: 6, meanHours: 6.5 }, 0.0714, { medianHours: 4, meanHours: 4 }],
    ]);
  });

  test('includes a week that ended exactly one week before the generation time', () => {
    const summaries = summarizeSettledWeeks(
      reportsFor(WEEK_2),
      new Date('2026-11-16T00:00:00.000Z'),
    );

    expect(summaries.map((week) => week.periodEnd)).toEqual([new Date(WEEK_2.periodEnd)]);
  });

  test('ignores a week that ended less than one week before the generation time', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [deploymentRow(WEEK_1, 10, '1.43'), deploymentRow(WEEK_2, 24, '3.43')],
      leadTime: [leadTimeRow(WEEK_1, 3, '1.00', '1.00'), leadTimeRow(WEEK_2, 5, '3.20', '3.60')],
      changeFailureRate: [cfrRow(WEEK_1, 10, 0, '0.0000'), cfrRow(WEEK_2, 24, 2, '0.0833')],
      mttr: [mttrRow(WEEK_1, 0, '0.00', '0.00'), mttrRow(WEEK_2, 1, '284.75', '284.75')],
    };

    const summaries = summarizeSettledWeeks(reports, new Date('2026-11-15T23:59:59.999Z'));

    expect(summaries.map((week) => week.periodEnd)).toEqual([new Date(WEEK_1.periodEnd)]);
  });

  test('reports zero deployments as zero and the change failure rate as no data', () => {
    const reports = reportsFor(WEEK_2, {
      deploymentFrequency: [deploymentRow(WEEK_2, 0, '0.00')],
      changeFailureRate: [cfrRow(WEEK_2, 0, 0, '0.0000')],
    });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect(summary.deploymentCount).toBe(0);
    expect(summary.deploymentsPerDay).toBe(0);
    expect(summary.changeFailure).toEqual({
      failedDeployments: 0,
      totalDeployments: 0,
      rate: null,
    });
  });

  test('reports a zero change failure rate when deployments happened and none failed', () => {
    const reports = reportsFor(WEEK_2, { changeFailureRate: [cfrRow(WEEK_2, 13, 0, '0.0000')] });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect(summary.changeFailure).toEqual({ failedDeployments: 0, totalDeployments: 13, rate: 0 });
  });

  test('reports lead time as no data when no issues were measured', () => {
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(WEEK_2, 0, '0.00', '0.00')] });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect(summary.leadTime).toBeNull();
  });

  test('reports time to restore as no data when there were no incidents', () => {
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_2, 0, '0.00', '0.00')] });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect(summary.restoreTime).toBeNull();
  });

  test('reports how many incidents are still open in a week with no restore time', () => {
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_2, 0, '0.00', '0.00', 2)] });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect([summary.restoreTime, summary.openIncidents]).toEqual([null, 2]);
  });

  test('reports the open incident count as unknown for an mttr row stored before it had that column', () => {
    const { openIncidentCount: _, ...olderRow } = mttrRow(WEEK_2, 0, '0.00', '0.00');
    const reports = reportsFor(WEEK_2, { mttr: [olderRow] });

    const [summary] = summarizeSettledWeeks(reports, GENERATED_AT);

    expect([summary.restoreTime, summary.openIncidents]).toEqual([null, null]);
  });

  test('throws naming the report when it has no week ending a week or more before the generation time', () => {
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_3, 0, '0.00', '0.00')] });

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'mttr-by-period.csv has no week ending at or before 2026-11-09T12:05:00.000Z',
    );
  });

  test('throws when the reports disagree on the week boundaries', () => {
    const shifted = {
      periodStart: '2026-11-02T00:00:03.000Z',
      periodEnd: '2026-11-09T00:00:03.000Z',
    };
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(shifted, 5, '3.20', '3.60')] });

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the week: deployment-frequency.csv has 2026-11-02T00:00:00.000Z–2026-11-09T00:00:00.000Z but lead-time-by-period.csv has 2026-11-02T00:00:03.000Z–2026-11-09T00:00:03.000Z',
    );
  });

  test('throws when the reports agree on the week end but not its start', () => {
    const laterStart = { periodStart: '2026-11-03T00:00:00.000Z', periodEnd: WEEK_2.periodEnd };
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(laterStart, 5, '3.20', '3.60')] });

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the week:',
    );
  });

  test('throws naming the first differing week when the reports agree on the latest week but not an earlier one', () => {
    const shiftedWeek1 = { periodStart: '2026-10-27T00:00:00.000Z', periodEnd: WEEK_1.periodEnd };
    const reports: ByPeriodReports = {
      ...reportsFor(WEEK_2),
      deploymentFrequency: [deploymentRow(WEEK_1, 10, '1.43'), deploymentRow(WEEK_2, 24, '3.43')],
      leadTime: [leadTimeRow(WEEK_1, 3, '1.00', '1.00'), leadTimeRow(WEEK_2, 5, '3.20', '3.60')],
      changeFailureRate: [cfrRow(shiftedWeek1, 10, 0, '0.0000'), cfrRow(WEEK_2, 24, 2, '0.0833')],
      mttr: [mttrRow(WEEK_1, 0, '0.00', '0.00'), mttrRow(WEEK_2, 1, '300.25', '284.75')],
    };

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the week: deployment-frequency.csv has 2026-10-26T00:00:00.000Z–2026-11-02T00:00:00.000Z but change-failure-rate-by-period.csv has 2026-10-27T00:00:00.000Z–2026-11-02T00:00:00.000Z',
    );
  });

  test('throws when a report has fewer settled weeks than the others', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [deploymentRow(WEEK_1, 10, '1.43'), deploymentRow(WEEK_2, 24, '3.43')],
      leadTime: [leadTimeRow(WEEK_1, 3, '1.00', '1.00'), leadTimeRow(WEEK_2, 5, '3.20', '3.60')],
      changeFailureRate: [cfrRow(WEEK_1, 10, 0, '0.0000'), cfrRow(WEEK_2, 24, 2, '0.0833')],
      mttr: [mttrRow(WEEK_1, 0, '0.00', '0.00')],
    };

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the week: deployment-frequency.csv has 2026-11-02T00:00:00.000Z–2026-11-09T00:00:00.000Z but mttr-by-period.csv has no week',
    );
  });

  test('throws when a report has more settled weeks than deployment frequency', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [deploymentRow(WEEK_1, 10, '1.43')],
      leadTime: [leadTimeRow(WEEK_1, 3, '1.00', '1.00'), leadTimeRow(WEEK_2, 5, '3.20', '3.60')],
      changeFailureRate: [cfrRow(WEEK_1, 10, 0, '0.0000')],
      mttr: [mttrRow(WEEK_1, 0, '0.00', '0.00')],
    };

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the week: deployment-frequency.csv has no week but lead-time-by-period.csv has 2026-11-02T00:00:00.000Z–2026-11-09T00:00:00.000Z',
    );
  });

  // A blank cell must not be read as 0: Number('') is 0, and the page would show it as a real value.
  test.each(['abc', '', 'Infinity'])(
    'throws naming the report and column when a value is %j instead of a number',
    (raw) => {
      const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_2, 1, raw, '1.00')] });

      expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
        `mttr-by-period.csv: meanRestoreTimeHours is not a number: "${raw}"`,
      );
    },
  );

  test('throws naming the lead time report and column when a value is not a number', () => {
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(WEEK_2, 5, '3.20', 'abc')] });

    expect(() => summarizeSettledWeeks(reports, GENERATED_AT)).toThrow(
      'lead-time-by-period.csv: medianLeadTimeHours is not a number: "abc"',
    );
  });
});
