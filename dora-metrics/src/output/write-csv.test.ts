import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { writeCsv } from './write-csv.js';

describe('writeCsv', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'dora-metrics-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('writes a header row and one row per bucket, including zero-count buckets', async () => {
    const rows = [
      {
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-08T00:00:00.000Z',
        deploymentCount: 3,
        deploymentsPerDay: (3 / 7).toFixed(2),
      },
      {
        periodStart: '2026-01-08T00:00:00.000Z',
        periodEnd: '2026-01-15T00:00:00.000Z',
        deploymentCount: 0,
        deploymentsPerDay: (0).toFixed(2),
      },
    ];
    const filePath = join(workDir, 'deployment-frequency.csv');

    await writeCsv(rows, filePath);

    const contents = await readFile(filePath, 'utf8');
    const lines = contents.trim().split('\n');
    expect(lines[0]).toBe('periodStart,periodEnd,deploymentCount,deploymentsPerDay');
    expect(lines[1]).toBe(
      `2026-01-01T00:00:00.000Z,2026-01-08T00:00:00.000Z,3,${(3 / 7).toFixed(2)}`,
    );
    expect(lines[2]).toBe('2026-01-08T00:00:00.000Z,2026-01-15T00:00:00.000Z,0,0.00');
  });

  test('creates the parent directory if it does not exist', async () => {
    const nestedDir = join(workDir, 'nested', 'dir');
    const filePath = join(nestedDir, 'deployment-frequency.csv');
    const rows = [
      {
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-08T00:00:00.000Z',
        deploymentCount: 1,
        deploymentsPerDay: (1 / 7).toFixed(2),
      },
    ];

    await writeCsv(rows, filePath);

    const dirStats = await stat(nestedDir);
    expect(dirStats.isDirectory()).toBe(true);

    const contents = await readFile(filePath, 'utf8');
    const lines = contents.trim().split('\n');
    expect(lines[0]).toBe('periodStart,periodEnd,deploymentCount,deploymentsPerDay');
    expect(lines[1]).toBe(
      `2026-01-01T00:00:00.000Z,2026-01-08T00:00:00.000Z,1,${(1 / 7).toFixed(2)}`,
    );
  });

  test('derives columns from the first row when none are given', async () => {
    const filePath = join(workDir, 'derived.csv');
    const rows = [
      { b: 'second', a: 'first' },
      { b: 'fourth', a: 'third' },
    ];

    await writeCsv(rows, filePath);

    const contents = await readFile(filePath, 'utf8');
    const lines = contents.trim().split('\n');
    expect(lines[0]).toBe('b,a');
    expect(lines[1]).toBe('second,first');
    expect(lines[2]).toBe('fourth,third');
  });

  test('an explicit columns argument produces a header-only CSV for an empty rows array', async () => {
    const filePath = join(workDir, 'empty.csv');

    await writeCsv([], filePath, ['periodStart', 'periodEnd', 'issueCount']);

    const contents = await readFile(filePath, 'utf8');
    expect(contents).toBe('periodStart,periodEnd,issueCount\n');
  });

  test('throws when rows is empty and no columns argument is given', async () => {
    const filePath = join(workDir, 'empty.csv');

    await expect(writeCsv([], filePath)).rejects.toThrow(
      'cannot determine columns for an empty rows array',
    );
  });
});
