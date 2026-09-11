import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { writeCsv } from './write-csv.js';
import { PeriodBucket } from '../metrics/deployment-frequency.js';

describe('writeCsv', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'dora-metrics-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('writes a header row and one row per bucket, including zero-count buckets', async () => {
    const buckets: PeriodBucket[] = [
      {
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-08T00:00:00.000Z',
        deploymentCount: 3,
        deploymentsPerDay: 3 / 7,
      },
      {
        periodStart: '2026-01-08T00:00:00.000Z',
        periodEnd: '2026-01-15T00:00:00.000Z',
        deploymentCount: 0,
        deploymentsPerDay: 0,
      },
    ];
    const filePath = join(workDir, 'deployment-frequency.csv');

    await writeCsv(buckets, filePath);

    const contents = await readFile(filePath, 'utf8');
    const lines = contents.trim().split('\n');
    expect(lines[0]).toBe('periodStart,periodEnd,deploymentCount,deploymentsPerDay');
    expect(lines[1]).toBe(`2026-01-01T00:00:00.000Z,2026-01-08T00:00:00.000Z,3,${3 / 7}`);
    expect(lines[2]).toBe('2026-01-08T00:00:00.000Z,2026-01-15T00:00:00.000Z,0,0');
  });

  test('creates the parent directory if it does not exist', async () => {
    const filePath = join(workDir, 'nested', 'dir', 'deployment-frequency.csv');
    const buckets: PeriodBucket[] = [
      {
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-08T00:00:00.000Z',
        deploymentCount: 1,
        deploymentsPerDay: 1 / 7,
      },
    ];

    await writeCsv(buckets, filePath);

    const contents = await readFile(filePath, 'utf8');
    expect(contents).toContain('periodStart,periodEnd,deploymentCount,deploymentsPerDay');
  });
});
