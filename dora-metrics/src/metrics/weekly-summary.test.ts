import { describe, expect, test } from 'vitest';
import { type ByPeriodReports, summarizeLatestWeek } from './weekly-summary.js';

const WEEK_1 = { periodStart: '2026-10-26T00:00:00.000Z', periodEnd: '2026-11-02T00:00:00.000Z' };
const WEEK_2 = { periodStart: '2026-11-02T00:00:00.000Z', periodEnd: '2026-11-09T00:00:00.000Z' };
const WEEK_3 = { periodStart: '2026-11-09T00:00:00.000Z', periodEnd: '2026-11-16T00:00:00.000Z' };

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

function mttrRow(week: Week, incidentCount: number, mean: string, median: string) {
  return {
    ...week,
    incidentCount: String(incidentCount),
    meanRestoreTimeHours: mean,
    medianRestoreTimeHours: median,
  };
}

function reportsFor(week: Week, overrides: Partial<ByPeriodReports> = {}): ByPeriodReports {
  return {
    deploymentFrequency: [deploymentRow(week, 24, '3.43')],
    leadTime: [leadTimeRow(week, 5, '3.20', '3.60')],
    changeFailureRate: [cfrRow(week, 24, 2, '0.0833')],
    mttr: [mttrRow(week, 1, '284.75', '284.75')],
    ...overrides,
  };
}

const GENERATED_AT = new Date('2026-11-16T12:05:00.000Z');

describe('summarizeLatestWeek', () => {
  test('summarizes the latest week ending at or before the generation time', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [deploymentRow(WEEK_1, 10, '1.43'), deploymentRow(WEEK_2, 24, '3.43')],
      leadTime: [leadTimeRow(WEEK_1, 3, '1.00', '1.00'), leadTimeRow(WEEK_2, 5, '3.20', '3.60')],
      changeFailureRate: [cfrRow(WEEK_1, 10, 0, '0.0000'), cfrRow(WEEK_2, 24, 2, '0.0833')],
      mttr: [mttrRow(WEEK_1, 0, '0.00', '0.00'), mttrRow(WEEK_2, 1, '284.75', '284.75')],
    };

    const summary = summarizeLatestWeek(reports, new Date('2026-11-10T00:00:00.000Z'));

    expect(summary).toEqual({
      periodStart: new Date(WEEK_2.periodStart),
      periodEnd: new Date(WEEK_2.periodEnd),
      deploymentCount: 24,
      deploymentsPerDay: 3.43,
      leadTime: { medianHours: 3.6, meanHours: 3.2 },
      changeFailure: { failedDeployments: 2, totalDeployments: 24, rate: 0.0833 },
      restoreTime: { medianHours: 284.75, meanHours: 284.75 },
    });
  });

  test('ignores weeks that end after the generation time', () => {
    const reports: ByPeriodReports = {
      deploymentFrequency: [deploymentRow(WEEK_2, 24, '3.43'), deploymentRow(WEEK_3, 1, '0.14')],
      leadTime: [leadTimeRow(WEEK_2, 5, '3.20', '3.60'), leadTimeRow(WEEK_3, 0, '0.00', '0.00')],
      changeFailureRate: [cfrRow(WEEK_2, 24, 2, '0.0833'), cfrRow(WEEK_3, 1, 0, '0.0000')],
      mttr: [mttrRow(WEEK_2, 1, '284.75', '284.75'), mttrRow(WEEK_3, 0, '0.00', '0.00')],
    };

    const summary = summarizeLatestWeek(reports, new Date('2026-11-15T23:59:59.999Z'));

    expect(summary.periodEnd).toEqual(new Date(WEEK_2.periodEnd));
  });

  test('includes a week whose end is exactly the generation time', () => {
    const summary = summarizeLatestWeek(reportsFor(WEEK_2), new Date(WEEK_2.periodEnd));

    expect(summary.periodEnd).toEqual(new Date(WEEK_2.periodEnd));
  });

  test('reports zero deployments as zero and the change failure rate as no data', () => {
    const reports = reportsFor(WEEK_2, {
      deploymentFrequency: [deploymentRow(WEEK_2, 0, '0.00')],
      changeFailureRate: [cfrRow(WEEK_2, 0, 0, '0.0000')],
    });

    const summary = summarizeLatestWeek(reports, GENERATED_AT);

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

    const summary = summarizeLatestWeek(reports, GENERATED_AT);

    expect(summary.changeFailure).toEqual({ failedDeployments: 0, totalDeployments: 13, rate: 0 });
  });

  test('reports lead time as no data when no issues were measured', () => {
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(WEEK_2, 0, '0.00', '0.00')] });

    const summary = summarizeLatestWeek(reports, GENERATED_AT);

    expect(summary.leadTime).toBeNull();
  });

  test('reports time to restore as no data when there were no incidents', () => {
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_2, 0, '0.00', '0.00')] });

    const summary = summarizeLatestWeek(reports, GENERATED_AT);

    expect(summary.restoreTime).toBeNull();
  });

  test('throws naming the report when it has no week ending at or before the generation time', () => {
    const unfinished = {
      periodStart: '2026-11-16T00:00:00.000Z',
      periodEnd: '2026-11-23T00:00:00.000Z',
    };
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(unfinished, 0, '0.00', '0.00')] });

    expect(() => summarizeLatestWeek(reports, GENERATED_AT)).toThrow(
      'mttr-by-period.csv has no week ending at or before 2026-11-16T12:05:00.000Z',
    );
  });

  test('throws when the reports disagree on the latest week boundaries', () => {
    const shifted = {
      periodStart: '2026-11-02T00:00:03.000Z',
      periodEnd: '2026-11-09T00:00:03.000Z',
    };
    const reports = reportsFor(WEEK_2, { leadTime: [leadTimeRow(shifted, 5, '3.20', '3.60')] });

    expect(() => summarizeLatestWeek(reports, GENERATED_AT)).toThrow(
      'By-period reports disagree on the latest week: deployment-frequency.csv has 2026-11-02T00:00:00.000Z–2026-11-09T00:00:00.000Z but lead-time-by-period.csv has 2026-11-02T00:00:03.000Z–2026-11-09T00:00:03.000Z',
    );
  });

  test('throws naming the report and column when a value is not a number', () => {
    const reports = reportsFor(WEEK_2, { mttr: [mttrRow(WEEK_2, 1, 'abc', '1.00')] });

    expect(() => summarizeLatestWeek(reports, GENERATED_AT)).toThrow(
      'mttr-by-period.csv: meanRestoreTimeHours is not a number: "abc"',
    );
  });
});
