import { describe, expect, test } from 'vitest';
import type { WeeklySummary } from '../metrics/weekly-summary.js';
import { renderDocsPage } from './render-docs-page.js';

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
    openIncidents: 0,
    ...overrides,
  };
}

// Oldest first. The middle week had no deployments, no deployed issues and no incidents.
const THREE_WEEKS: WeeklySummary[] = [
  summaryWith({
    periodStart: new Date('2026-10-19T00:00:00.000Z'),
    periodEnd: new Date('2026-10-26T00:00:00.000Z'),
    deploymentCount: 10,
    deploymentsPerDay: 1.43,
    leadTime: { medianHours: 1, meanHours: 1.5 },
    changeFailure: { failedDeployments: 0, totalDeployments: 10, rate: 0 },
    restoreTime: { medianHours: 5, meanHours: 5 },
  }),
  summaryWith({
    periodStart: new Date('2026-10-26T00:00:00.000Z'),
    periodEnd: new Date('2026-11-02T00:00:00.000Z'),
    deploymentCount: 0,
    deploymentsPerDay: 0,
    leadTime: null,
    changeFailure: { failedDeployments: 0, totalDeployments: 0, rate: null },
    restoreTime: null,
  }),
  summaryWith(),
];

describe('renderDocsPage', () => {
  test('renders the headline for the newest week, then the trend for every week', () => {
    const page = renderDocsPage(THREE_WEEKS, { generatedAt: GENERATED_AT, run: RUN });

    expect(page).toBe(
      [
        '# DORA Metrics',
        '',
        'These numbers update weekly, after the Tuesday DORA Metrics run. They cover the week before last,',
        'so changes closed late in the week have time to deploy and incidents have time to close.',
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
        '## Last 3 weeks',
        '',
        '### Deployments per week',
        '',
        '```mermaid',
        `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
        'xychart-beta',
        '  x-axis ["10-19", "10-26", "11-02"]',
        '  y-axis 0 --> 24',
        '  line [10, 0, 24]',
        '```',
        '',
        '### Lead time for changes (median, hours)',
        '',
        '```mermaid',
        `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
        'xychart-beta',
        '  x-axis ["10-19", "11-02"]',
        '  y-axis 0 --> 3.6',
        '  line [1.0, 3.6]',
        '```',
        '',
        'Weeks with no data are not plotted; see the table below.',
        '',
        '### Change failure rate (%)',
        '',
        '```mermaid',
        `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
        'xychart-beta',
        '  x-axis ["10-19", "11-02"]',
        '  y-axis 0 --> 8.3',
        '  line [0.0, 8.3]',
        '```',
        '',
        'Weeks with no data are not plotted; see the table below.',
        '',
        '### Time to restore service (median, days)',
        '',
        '```mermaid',
        `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
        'xychart-beta',
        '  x-axis ["10-19", "11-02"]',
        '  y-axis 0 --> 11.9',
        '  line [0.2, 11.9]',
        '```',
        '',
        'Weeks without a closed incident are not plotted; see the table below.',
        '',
        '| Week of | Deployments | Lead time (median) | Change failure rate | Time to restore (median) |',
        '| --- | --- | --- | --- | --- |',
        '| Mon 2026-10-19 | 10 | 1.0 hours | 0.0% | 5.0 hours |',
        '| Mon 2026-10-26 | 0 | No data | No data | No incidents |',
        '| Mon 2026-11-02 | 24 | 3.6 hours | 8.3% | 11.9 days |',
        '',
        `Generated 2026-11-16T12:05:00.000Z from [DORA Metrics run 43955771750](${RUN.url})`,
        '',
      ].join('\n'),
    );
  });

  test('shows a metric with no data in any week as text instead of a chart', () => {
    const weeks = THREE_WEEKS.map((week) => ({ ...week, restoreTime: null }));

    const page = renderDocsPage(weeks, { generatedAt: GENERATED_AT, run: RUN });

    expect(page).toContain(
      ['### Time to restore service (median)', '', 'No closed incidents in these weeks', ''].join(
        '\n',
      ),
    );
    expect(page.match(/```mermaid/g)).toHaveLength(3);
  });

  test.each([
    { medianHours: 47.9, unit: 'hours', plotted: '[5.0, 47.9]', top: '47.9' },
    { medianHours: 48, unit: 'days', plotted: '[0.2, 2.0]', top: '2.0' },
  ])(
    'plots every restore time in $unit when the longest median is $medianHours hours',
    ({ medianHours, unit, plotted, top }) => {
      const weeks = [
        THREE_WEEKS[0],
        summaryWith({ restoreTime: { medianHours, meanHours: medianHours } }),
      ];

      const page = renderDocsPage(weeks, { generatedAt: GENERATED_AT, run: RUN });

      expect(page).toContain(
        [
          `### Time to restore service (median, ${unit})`,
          '',
          '```mermaid',
          `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
          'xychart-beta',
          '  x-axis ["10-19", "11-02"]',
          `  y-axis 0 --> ${top}`,
          `  line ${plotted}`,
        ].join('\n'),
      );
    },
  );

  test('plots a metric with data in only one week as a bar, since a one-point line draws nothing', () => {
    const weeks = [THREE_WEEKS[1], summaryWith({ restoreTime: { medianHours: 5, meanHours: 5 } })];

    const page = renderDocsPage(weeks, { generatedAt: GENERATED_AT, run: RUN });

    expect(page).toContain(
      [
        '### Time to restore service (median, hours)',
        '',
        '```mermaid',
        `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#005ea2"}}}}%%`,
        'xychart-beta',
        '  x-axis ["11-02"]',
        '  y-axis 0 --> 5.0',
        '  bar [5.0]',
        '```',
      ].join('\n'),
    );
  });

  test('shows zero deployments as zero and the change failure rate as no data', () => {
    const page = renderDocsPage(
      [
        summaryWith({
          deploymentCount: 0,
          deploymentsPerDay: 0,
          changeFailure: { failedDeployments: 0, totalDeployments: 0, rate: null },
        }),
      ],
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('| Deployment frequency | 0 deployments (0.0 per day) |');
    expect(page).toContain('| Change failure rate | No data (no deployments) |');
  });

  test('shows a zero change failure rate with counts when nothing failed', () => {
    const page = renderDocsPage(
      [summaryWith({ changeFailure: { failedDeployments: 0, totalDeployments: 13, rate: 0 } })],
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('| Change failure rate | 0.0% (0 of 13 deployments) |');
  });

  test('uses the singular for one deployment', () => {
    const page = renderDocsPage(
      [
        summaryWith({
          deploymentCount: 1,
          deploymentsPerDay: 0.14,
          changeFailure: { failedDeployments: 0, totalDeployments: 1, rate: 0 },
        }),
      ],
      { generatedAt: GENERATED_AT, run: RUN },
    );

    expect(page).toContain('## Last 1 week\n');
    expect(page).toContain('| Deployment frequency | 1 deployment (0.1 per day) |');
    expect(page).toContain('| Change failure rate | 0.0% (0 of 1 deployment) |');
  });

  test('shows lead time as no data and time to restore as no incidents rather than zero', () => {
    const page = renderDocsPage([summaryWith({ leadTime: null, restoreTime: null })], {
      generatedAt: GENERATED_AT,
      run: RUN,
    });

    expect(page).toContain('| Lead time for changes | No data |');
    expect(page).toContain('| Time to restore service | No incidents |');
  });

  test.each([
    { openIncidents: 1, shown: '1 incident still open' },
    { openIncidents: 2, shown: '2 incidents still open' },
  ])(
    'shows time to restore as "$shown" when no incident has closed',
    ({ openIncidents, shown }) => {
      const page = renderDocsPage([summaryWith({ restoreTime: null, openIncidents })], {
        generatedAt: GENERATED_AT,
        run: RUN,
      });

      expect(page).toContain(`| Time to restore service | ${shown} |`);
      expect(page).toContain(`| 24 | 3.6 hours | 8.3% | ${shown} |`);
    },
  );

  test('starts the scale at 0 to 1 when every plotted value is 0', () => {
    const weeks = THREE_WEEKS.map((week) => ({
      ...week,
      changeFailure: { failedDeployments: 0, totalDeployments: 10, rate: 0 },
    }));

    const page = renderDocsPage(weeks, { generatedAt: GENERATED_AT, run: RUN });

    expect(page).toContain('  y-axis 0 --> 1\n  line [0.0, 0.0, 0.0]');
  });

  test('shows durations under 48 hours in hours and 48 hours or more in days', () => {
    const page = renderDocsPage(
      [summaryWith({ restoreTime: { medianHours: 47.9, meanHours: 48 } })],
      {
        generatedAt: GENERATED_AT,
        run: RUN,
      },
    );

    expect(page).toContain('| Time to restore service | 47.9 hours (mean 2.0 days) |');
  });

  // 03:00 UTC on Monday is still Sunday in New York. Pinning TZ makes this fail on any machine,
  // UTC CI runners included, if a local-time getter is used.
  test('labels weekdays in UTC whatever the machine time zone', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const page = renderDocsPage(
        [
          summaryWith({
            periodStart: new Date('2026-11-02T03:00:00.000Z'),
            periodEnd: new Date('2026-11-09T03:00:00.000Z'),
          }),
        ],
        { generatedAt: GENERATED_AT, run: RUN },
      );

      expect(page).toContain('## Week of Mon 2026-11-02 – Sun 2026-11-08 (UTC)');
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });

  test('credits a local run without a link when no run is given', () => {
    const page = renderDocsPage([summaryWith()], { generatedAt: GENERATED_AT });

    expect(page).toContain('Generated 2026-11-16T12:05:00.000Z from local run');
    expect(page).not.toContain('](');
  });

  // The Pages fetch step rejects any page containing '<', and Docsify renders HTML inside markdown.
  test('contains no angle bracket and does not call the deployments production', () => {
    const page = renderDocsPage(THREE_WEEKS, { generatedAt: GENERATED_AT, run: RUN });

    expect(page).not.toContain('<');
    expect(page.toLowerCase()).not.toContain('production');
  });
});
