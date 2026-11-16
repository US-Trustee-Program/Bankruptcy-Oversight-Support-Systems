import { describe, expect, test } from 'vitest';
import type { WeeklySummary } from '../metrics/weekly-summary.js';
import { formatDuration, renderDocsPage } from './render-docs-page.js';

const GENERATED_AT = new Date('2026-11-16T12:05:00.000Z');
const RUN = {
  id: '43955771750',
  url: 'https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/actions/runs/43955771750',
};

function summaryWith(overrides: Partial<WeeklySummary> = {}): WeeklySummary {
  return {
    periodStart: new Date('2026-11-02T00:00:00.000Z'),
    periodEnd: new Date('2026-11-09T00:00:00.000Z'),
    deploymentCount: 24,
    deploymentsPerDay: 3.43,
    leadTime: { medianHours: 3.6, meanHours: 3.2 },
    changeFailure: { failedDeployments: 2, totalDeployments: 24, rate: 0.0833 },
    restoreTime: { medianHours: 284.75, meanHours: 284.75 },
    ...overrides,
  };
}

describe('formatDuration', () => {
  test('shows durations under 48 hours in hours with one decimal', () => {
    expect(formatDuration(47.9)).toBe('47.9 hours');
    expect(formatDuration(3.6)).toBe('3.6 hours');
  });

  test('shows durations of 48 hours or more in days with one decimal', () => {
    expect(formatDuration(48)).toBe('2.0 days');
    expect(formatDuration(284.75)).toBe('11.9 days');
  });
});

describe('renderDocsPage', () => {
  test('renders the full page for a typical week', () => {
    const page = renderDocsPage(summaryWith(), { generatedAt: GENERATED_AT, run: RUN });

    expect(page).toBe(
      [
        '# DORA Metrics',
        '',
        'These numbers update weekly, after the Monday DORA Metrics run.',
        '',
        '## Week of Mon 2026-11-02 – Sun 2026-11-08 (UTC)',
        '',
        '| Metric | Value |',
        '| --- | --- |',
        '| Deployment frequency | 24 deployments (3.4 per day) |',
        '| Lead time for changes | 3.6 hours (mean 3.2 hours) |',
        '| Change failure rate | 8.3% (2 of 24 deployments) |',
        '| Time to restore service | 11.9 days (mean 11.9 days) |',
        '',
        `Generated 2026-11-16T12:05:00.000Z from [DORA Metrics run 43955771750](${RUN.url})`,
        '',
      ].join('\n'),
    );
  });

  test('shows zero deployments as zero and the change failure rate as no data', () => {
    const page = renderDocsPage(
      summaryWith({
        deploymentCount: 0,
        deploymentsPerDay: 0,
        changeFailure: { failedDeployments: 0, totalDeployments: 0, rate: null },
      }),
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('| Deployment frequency | 0 deployments (0.0 per day) |');
    expect(page).toContain('| Change failure rate | No data (no deployments) |');
  });

  test('shows a zero change failure rate with counts when nothing failed', () => {
    const page = renderDocsPage(
      summaryWith({ changeFailure: { failedDeployments: 0, totalDeployments: 13, rate: 0 } }),
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('| Change failure rate | 0.0% (0 of 13 deployments) |');
  });

  test('uses the singular for one deployment', () => {
    const page = renderDocsPage(
      summaryWith({
        deploymentCount: 1,
        deploymentsPerDay: 0.14,
        changeFailure: { failedDeployments: 0, totalDeployments: 1, rate: 0 },
      }),
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('| Deployment frequency | 1 deployment (0.1 per day) |');
    expect(page).toContain('| Change failure rate | 0.0% (0 of 1 deployment) |');
  });

  test('shows lead time and time to restore as no data rather than zero', () => {
    const page = renderDocsPage(summaryWith({ leadTime: null, restoreTime: null }), {
      generatedAt: GENERATED_AT,
      run: RUN,
    });

    expect(page).toContain('| Lead time for changes | No data |');
    expect(page).toContain('| Time to restore service | No data |');
  });

  test('credits a local run without a link when no run is given', () => {
    const page = renderDocsPage(summaryWith(), { generatedAt: GENERATED_AT });

    expect(page).toContain('Generated 2026-11-16T12:05:00.000Z from local run');
    expect(page).not.toContain('](');
  });

  test('contains no raw HTML and does not call the deployments production', () => {
    const page = renderDocsPage(summaryWith(), { generatedAt: GENERATED_AT, run: RUN });

    expect(page).not.toMatch(/<[a-z/!]/i);
    expect(page.toLowerCase()).not.toContain('production');
  });
});
