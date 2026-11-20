import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resolveReportOptions } from './resolve-report-options.js';

const ENV_KEYS = [
  'DORA_OWNER',
  'DORA_REPO',
  'DORA_WORKFLOW_FILE_NAME',
  'DORA_BRANCH',
  'DORA_TICKET_LABEL_PATTERN',
  'DORA_START_DATE',
  'DORA_PERIOD_DAYS',
] as const;

describe('resolveReportOptions', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T00:00:00.000Z'));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    vi.useRealTimers();
  });

  test('uses documented defaults when no env vars are set', () => {
    const options = resolveReportOptions();

    expect(options.owner).toBe('US-Trustee-Program');
    expect(options.repo).toBe('Bankruptcy-Oversight-Support-Systems');
    expect(options.workflowFileName).toBe('continuous-deployment.yml');
    expect(options.branch).toBe('main');
    expect(options.ticketLabelPattern).toEqual(/^CAMS-\d+$/);
    expect(options.periodDays).toBe(7);
    expect(options.endDate).toEqual(new Date('2026-01-05T00:00:00.000Z'));
    expect(options.startDate).toEqual(new Date('2025-10-06T00:00:00.000Z'));
  });

  test('reads owner, repo, workflowFileName, branch, and ticketLabelPattern from env vars when set', () => {
    process.env.DORA_OWNER = 'some-org';
    process.env.DORA_REPO = 'some-repo';
    process.env.DORA_WORKFLOW_FILE_NAME = 'deploy.yml';
    process.env.DORA_BRANCH = 'develop';
    process.env.DORA_TICKET_LABEL_PATTERN = '^JIRA-\\d+$';

    const options = resolveReportOptions();

    expect(options.owner).toBe('some-org');
    expect(options.repo).toBe('some-repo');
    expect(options.workflowFileName).toBe('deploy.yml');
    expect(options.branch).toBe('develop');
    expect(options.ticketLabelPattern).toEqual(/^JIRA-\d+$/);
  });

  test('treats empty-string env vars as unset and falls back to defaults', () => {
    process.env.DORA_OWNER = '';
    process.env.DORA_REPO = '';
    process.env.DORA_WORKFLOW_FILE_NAME = '';
    process.env.DORA_BRANCH = '';
    process.env.DORA_TICKET_LABEL_PATTERN = '';

    const options = resolveReportOptions();

    expect(options.owner).toBe('US-Trustee-Program');
    expect(options.repo).toBe('Bankruptcy-Oversight-Support-Systems');
    expect(options.workflowFileName).toBe('continuous-deployment.yml');
    expect(options.branch).toBe('main');
    expect(options.ticketLabelPattern).toEqual(/^CAMS-\d+$/);
  });

  test('throws when DORA_TICKET_LABEL_PATTERN is not a valid regular expression', () => {
    process.env.DORA_TICKET_LABEL_PATTERN = '(unclosed';

    expect(() => resolveReportOptions()).toThrow('Invalid DORA_TICKET_LABEL_PATTERN: (unclosed');
  });

  test('parses DORA_PERIOD_DAYS from the environment', () => {
    process.env.DORA_PERIOD_DAYS = '14';

    const options = resolveReportOptions();

    expect(options.periodDays).toBe(14);
  });

  test('treats an empty-string DORA_PERIOD_DAYS as unset and falls back to the default', () => {
    process.env.DORA_PERIOD_DAYS = '';

    const options = resolveReportOptions();

    expect(options.periodDays).toBe(7);
  });

  test('parses DORA_START_DATE from the environment', () => {
    process.env.DORA_START_DATE = '2026-01-01T00:00:00.000Z';

    const options = resolveReportOptions();

    expect(options.startDate).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  test('treats an empty-string DORA_START_DATE as unset and falls back to the default lookback', () => {
    process.env.DORA_START_DATE = '';

    const options = resolveReportOptions();

    expect(options.startDate).toEqual(new Date('2025-10-06T00:00:00.000Z'));
  });

  test('throws when DORA_START_DATE is not a valid date', () => {
    process.env.DORA_START_DATE = 'not-a-date';

    expect(() => resolveReportOptions()).toThrow('Invalid DORA_START_DATE: not-a-date');
  });

  test('throws naming the report end when DORA_START_DATE is after it', () => {
    vi.setSystemTime(new Date('2026-11-11T15:30:00.000Z'));
    process.env.DORA_START_DATE = '2026-11-10T00:00:00.000Z';

    expect(() => resolveReportOptions()).toThrow(
      'DORA_START_DATE 2026-11-10T00:00:00.000Z is after the report end 2026-11-09T00:00:00.000Z (most recent Monday 00:00 UTC)',
    );
  });
  describe('default window snaps to complete calendar weeks', () => {
    test('on a Wednesday, ends at the most recent Monday 00:00 UTC and starts 13 weeks earlier', () => {
      vi.setSystemTime(new Date('2026-11-11T15:30:00.000Z'));

      const options = resolveReportOptions();

      expect(options.endDate).toEqual(new Date('2026-11-09T00:00:00.000Z'));
      expect(options.startDate).toEqual(new Date('2026-08-10T00:00:00.000Z'));
    });

    test('ends at the current instant when it is exactly Monday 00:00 UTC', () => {
      vi.setSystemTime(new Date('2026-11-09T00:00:00.000Z'));

      const options = resolveReportOptions();

      expect(options.endDate).toEqual(new Date('2026-11-09T00:00:00.000Z'));
    });

    test('ends at a Monday in the previous month and year when the week spans New Year', () => {
      vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

      const options = resolveReportOptions();

      expect(options.endDate).toEqual(new Date('2025-12-29T00:00:00.000Z'));
    });

    test('ends at the previous Monday on the last millisecond of Sunday', () => {
      vi.setSystemTime(new Date('2026-11-15T23:59:59.999Z'));

      const options = resolveReportOptions();

      expect(options.endDate).toEqual(new Date('2026-11-09T00:00:00.000Z'));
    });

    test('still snaps endDate when DORA_START_DATE overrides the start', () => {
      vi.setSystemTime(new Date('2026-11-11T15:30:00.000Z'));
      process.env.DORA_START_DATE = '2026-06-03T12:00:00.000Z';

      const options = resolveReportOptions();

      expect(options.startDate).toEqual(new Date('2026-06-03T12:00:00.000Z'));
      expect(options.endDate).toEqual(new Date('2026-11-09T00:00:00.000Z'));
    });
  });
});
