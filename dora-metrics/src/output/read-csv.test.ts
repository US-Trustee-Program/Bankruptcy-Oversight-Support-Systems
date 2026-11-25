import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { parseCsv, readCsv } from './read-csv.js';

const COLUMNS = ['periodStart', 'periodEnd', 'deploymentCount'];

describe('parseCsv', () => {
  test('returns one record per data row keyed by the header columns', () => {
    const text =
      'periodStart,periodEnd,deploymentCount\n' +
      '2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z,24\n' +
      '2026-11-09T00:00:00.000Z,2026-11-16T00:00:00.000Z,0\n';

    const rows = parseCsv(text, COLUMNS, 'deployment-frequency.csv');

    expect(rows).toEqual([
      {
        periodStart: '2026-11-02T00:00:00.000Z',
        periodEnd: '2026-11-09T00:00:00.000Z',
        deploymentCount: '24',
      },
      {
        periodStart: '2026-11-09T00:00:00.000Z',
        periodEnd: '2026-11-16T00:00:00.000Z',
        deploymentCount: '0',
      },
    ]);
  });

  test('accepts CRLF line endings and a missing trailing newline', () => {
    const text =
      'periodStart,periodEnd,deploymentCount\r\n' +
      '2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z,24';

    const rows = parseCsv(text, COLUMNS, 'deployment-frequency.csv');

    expect(rows).toHaveLength(1);
    expect(rows[0].deploymentCount).toBe('24');
  });

  test('throws naming the source when the header does not match the expected columns', () => {
    const text =
      'periodStart,periodEnd,count\n2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z,24\n';

    expect(() => parseCsv(text, COLUMNS, 'deployment-frequency.csv')).toThrow(
      'deployment-frequency.csv: expected header "periodStart,periodEnd,deploymentCount" but found "periodStart,periodEnd,count"',
    );
  });

  test('accepts an older header, keying rows by the older columns', () => {
    const text = 'periodStart,periodEnd\n2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z\n';

    const rows = parseCsv(text, COLUMNS, 'deployment-frequency.csv', ['periodStart', 'periodEnd']);

    expect(rows).toEqual([
      { periodStart: '2026-11-02T00:00:00.000Z', periodEnd: '2026-11-09T00:00:00.000Z' },
    ]);
  });

  test('names the current header, not the older one, when neither matches', () => {
    expect(() =>
      parseCsv('periodStart,count\n', COLUMNS, 'deployment-frequency.csv', ['periodStart']),
    ).toThrow(
      'expected header "periodStart,periodEnd,deploymentCount" but found "periodStart,count"',
    );
  });

  test('throws naming the source when the file is empty', () => {
    expect(() => parseCsv('', COLUMNS, 'deployment-frequency.csv')).toThrow(
      'deployment-frequency.csv: expected header "periodStart,periodEnd,deploymentCount" but found ""',
    );
  });

  test('throws naming the source and line when a row has too few fields', () => {
    const text = 'periodStart,periodEnd,deploymentCount\n2026-11-02T00:00:00.000Z,24\n';

    expect(() => parseCsv(text, COLUMNS, 'deployment-frequency.csv')).toThrow(
      'deployment-frequency.csv line 2: expected 3 fields but found 2',
    );
  });

  test('throws naming the source and line when a row has too many fields', () => {
    const text =
      'periodStart,periodEnd,deploymentCount\n' +
      '2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z,24,extra\n';

    expect(() => parseCsv(text, COLUMNS, 'deployment-frequency.csv')).toThrow(
      'deployment-frequency.csv line 2: expected 3 fields but found 4',
    );
  });
});

describe('readCsv', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'dora-metrics-read-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('reads and parses the file at the given path', async () => {
    const filePath = join(workDir, 'deployment-frequency.csv');
    await writeFile(
      filePath,
      'periodStart,periodEnd,deploymentCount\n2026-11-02T00:00:00.000Z,2026-11-09T00:00:00.000Z,24\n',
      'utf8',
    );

    const rows = await readCsv(filePath, COLUMNS);

    expect(rows).toEqual([
      {
        periodStart: '2026-11-02T00:00:00.000Z',
        periodEnd: '2026-11-09T00:00:00.000Z',
        deploymentCount: '24',
      },
    ]);
  });

  test('passes the older columns through to the parser', async () => {
    const filePath = join(workDir, 'deployment-frequency.csv');
    await writeFile(filePath, 'periodStart\n2026-11-02T00:00:00.000Z\n', 'utf8');

    const rows = await readCsv(filePath, COLUMNS, ['periodStart']);

    expect(rows).toEqual([{ periodStart: '2026-11-02T00:00:00.000Z' }]);
  });

  test('names the file path when the file cannot be parsed', async () => {
    const filePath = join(workDir, 'deployment-frequency.csv');
    await writeFile(filePath, 'periodStart,periodEnd,count\n', 'utf8');

    await expect(readCsv(filePath, COLUMNS)).rejects.toThrow(`${filePath}: expected header`);
  });

  test('throws a clear error when the file does not exist', async () => {
    const filePath = join(workDir, 'mttr-by-period.csv');

    await expect(readCsv(filePath, COLUMNS)).rejects.toThrow(`Missing CSV file: ${filePath}`);
  });

  test('passes other read errors through unchanged', async () => {
    await expect(readCsv(workDir, COLUMNS)).rejects.toMatchObject({ code: 'EISDIR' });
  });
});
