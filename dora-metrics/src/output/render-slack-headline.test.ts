import { describe, expect, test } from 'vitest';
import type { WeeklySummary } from '../metrics/weekly-summary.js';
import { renderDocsPage } from './render-docs-page.js';
import { renderSlackHeadline } from './render-slack-headline.js';

function summaryWith(overrides: Partial<WeeklySummary> = {}): WeeklySummary {
  return {
    periodStart: new Date('2026-11-09T00:00:00.000Z'),
    periodEnd: new Date('2026-11-16T00:00:00.000Z'),
    deploymentCount: 8,
    deploymentsPerDay: 1.14,
    leadTime: { medianHours: 5.8, meanHours: 13 },
    changeFailure: { failedDeployments: 0, totalDeployments: 8, rate: 0 },
    restoreTime: null,
    openIncidents: 0,
    ...overrides,
  };
}

const FIXTURES: Record<string, WeeklySummary> = {
  'no incidents': summaryWith(),
  'one incident still open': summaryWith({ openIncidents: 1 }),
  'incidents still open': summaryWith({ openIncidents: 3 }),
  'a restore time': summaryWith({ restoreTime: { medianHours: 2.5, meanHours: 4 } }),
  'a lead time over 48 hours': summaryWith({ leadTime: { medianHours: 60, meanHours: 72 } }),
  'no deployments': summaryWith({
    deploymentCount: 0,
    deploymentsPerDay: 0,
    leadTime: null,
    changeFailure: { failedDeployments: 0, totalDeployments: 0, rate: null },
  }),
};

function lineFor(headline: string, label: string): string | undefined {
  return headline.split('\n').find((line) => line.startsWith(`• ${label}: `));
}

describe('renderSlackHeadline', () => {
  test('renders the week and the four headline metrics as plain text', () => {
    expect(renderSlackHeadline(summaryWith())).toBe(
      [
        'DORA metrics for the week of Mon 2026-11-09 – Sun 2026-11-15 (UTC)',
        '• Deployment frequency: 8 deployments (1.1 per day)',
        '• Lead time for changes: 5.8 hours (mean 13.0 hours)',
        '• Change failure rate: 0.0% (0 of 8 deployments)',
        '• Time to restore service: No incidents',
      ].join('\n'),
    );
  });

  test.each([
    ['one incident still open', '• Time to restore service: 1 incident still open'],
    ['incidents still open', '• Time to restore service: 3 incidents still open'],
    ['a restore time', '• Time to restore service: 2.5 hours (mean 4.0 hours)'],
    ['a lead time over 48 hours', '• Lead time for changes: 2.5 days (mean 3.0 days)'],
    ['no deployments', '• Change failure rate: No data (no deployments)'],
  ])('shows %s', (name, expected) => {
    const label = expected.slice(2, expected.indexOf(':'));
    expect(lineFor(renderSlackHeadline(FIXTURES[name]), label)).toBe(expected);
  });

  test('shows no deployments as zero, and lead time as no data', () => {
    const headline = renderSlackHeadline(FIXTURES['no deployments']);

    expect(lineFor(headline, 'Deployment frequency')).toBe(
      '• Deployment frequency: 0 deployments (0.0 per day)',
    );
    expect(lineFor(headline, 'Lead time for changes')).toBe('• Lead time for changes: No data');
  });

  test.each(Object.keys(FIXTURES))(
    'matches the docs page "Week of" table for a week with %s',
    (name) => {
      const week = FIXTURES[name];
      const page = renderDocsPage([week], { generatedAt: new Date('2026-11-24T00:00:00.000Z') });
      const headline = renderSlackHeadline(week);

      for (const label of [
        'Deployment frequency',
        'Lead time for changes',
        'Change failure rate',
        'Time to restore service',
      ]) {
        const tableValue = page
          .split('\n')
          .find((line) => line.startsWith(`| ${label} | `))
          ?.slice(`| ${label} | `.length, -' |'.length);
        expect(tableValue).toBeDefined();
        expect(lineFor(headline, label)).toBe(`• ${label}: ${tableValue}`);
      }
      const pageWeek = page
        .split('\n')
        .find((line) => line.startsWith('## Week of '))
        ?.slice('## Week of '.length);
      expect(headline.split('\n')[0]).toBe(`DORA metrics for the week of ${pageWeek}`);
    },
  );

  test.each(Object.keys(FIXTURES))(
    'contains no Slack control characters for a week with %s',
    (name) => {
      expect(renderSlackHeadline(FIXTURES[name])).not.toMatch(/[<>&@]/);
    },
  );
});
