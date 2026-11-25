import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readHistory } from './read-history.js';

const WEEK = '2026-10-05T00:00:00.000Z,2026-10-12T00:00:00.000Z';

const BY_PERIOD_FILES: Record<string, string> = {
  'deployment-frequency.csv': `periodStart,periodEnd,deploymentCount,deploymentsPerDay\n${WEEK},7,1.00\n`,
  'lead-time-by-period.csv': `periodStart,periodEnd,issueCount,meanLeadTimeHours,medianLeadTimeHours\n${WEEK},1,2.00,2.00\n`,
  'change-failure-rate-by-period.csv': `periodStart,periodEnd,totalDeployments,failedDeployments,changeFailureRate\n${WEEK},7,0,0.0000\n`,
  'mttr-by-period.csv': `periodStart,periodEnd,incidentCount,meanRestoreTimeHours,medianRestoreTimeHours,openIncidentCount\n${WEEK},0,0.00,0.00,0\n`,
};

describe('readHistory', () => {
  let historyDir: string;

  beforeEach(async () => {
    historyDir = await mkdtemp(join(tmpdir(), 'dora-metrics-history-'));
  });

  afterEach(async () => {
    await rm(historyDir, { recursive: true, force: true });
  });

  async function writeRun(folder: string, files: Record<string, string> = BY_PERIOD_FILES) {
    await mkdir(join(historyDir, folder));
    for (const [name, text] of Object.entries(files)) {
      await writeFile(join(historyDir, folder, name), text, 'utf8');
    }
  }

  test('reads the four by-period CSVs of every run folder, with the folder date and run id', async () => {
    await writeRun('2026-11-21-44849948694');
    await writeRun('2026-11-24-45000000001');

    const runs = await readHistory(historyDir);

    expect(runs.map(({ runDate, runId }) => [runDate, runId])).toEqual([
      ['2026-11-21', 44849948694],
      ['2026-11-24', 45000000001],
    ]);
    expect(runs[0].reports.deploymentFrequency).toEqual([
      {
        periodStart: '2026-10-05T00:00:00.000Z',
        periodEnd: '2026-10-12T00:00:00.000Z',
        deploymentCount: '7',
        deploymentsPerDay: '1.00',
      },
    ]);
    expect(Object.keys(runs[0].reports).sort()).toEqual([
      'changeFailureRate',
      'deploymentFrequency',
      'leadTime',
      'mttr',
    ]);
  });

  test('never reads a detail CSV, which holds issue text', async () => {
    await writeRun('2026-11-21-44849948694', {
      ...BY_PERIOD_FILES,
      'lead-time-detail.csv': 'issueNumber,title\n1,lead time issue title\n',
      'change-failure-detail.csv': 'issueNumber,title\n2,change failure issue title\n',
      'mttr-detail.csv': 'issueNumber,title\n3,mttr issue title\n',
    });

    const [run] = await readHistory(historyDir);

    expect(JSON.stringify(run)).not.toContain('issue title');
  });

  test('leaves out a report whose file the run folder does not have', async () => {
    const { 'mttr-by-period.csv': _, ...withoutMttr } = BY_PERIOD_FILES;
    await writeRun('2026-11-21-44849948694', withoutMttr);

    const [run] = await readHistory(historyDir);

    expect(run.reports.mttr).toBeUndefined();
    expect(run.reports.deploymentFrequency).toHaveLength(1);
  });

  test('reads an mttr file stored before it had the open incident count', async () => {
    await writeRun('2026-11-21-44849948694', {
      ...BY_PERIOD_FILES,
      'mttr-by-period.csv': `periodStart,periodEnd,incidentCount,meanRestoreTimeHours,medianRestoreTimeHours\n${WEEK},0,0.00,0.00\n`,
    });

    const [run] = await readHistory(historyDir);

    expect(run.reports.mttr?.[0]).not.toHaveProperty('openIncidentCount');
  });

  test('ignores entries that are not run folders', async () => {
    await writeRun('2026-11-21-44849948694');
    await writeRun('scratch');
    await writeFile(join(historyDir, '2026-11-24-45000000001'), 'a file, not a folder', 'utf8');

    const runs = await readHistory(historyDir);

    expect(runs.map(({ runId }) => runId)).toEqual([44849948694]);
  });

  test('fails when the directory has no run folders', async () => {
    await expect(readHistory(historyDir)).rejects.toThrow(
      `No stored DORA runs (YYYY-MM-DD-<run id> folders) in ${historyDir}`,
    );
  });

  test('fails when the directory cannot be read', async () => {
    const missing = join(historyDir, 'missing');

    await expect(readHistory(missing)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('fails naming the file when a stored CSV cannot be parsed', async () => {
    await writeRun('2026-11-21-44849948694', {
      ...BY_PERIOD_FILES,
      'lead-time-by-period.csv': 'periodStart,count\n',
    });

    await expect(readHistory(historyDir)).rejects.toThrow(
      join(historyDir, '2026-11-21-44849948694', 'lead-time-by-period.csv'),
    );
  });
});
