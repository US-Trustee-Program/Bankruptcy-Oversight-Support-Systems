import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { StoredRun } from '../metrics/history.js';
import { BY_PERIOD_REPORTS, type ByPeriodReports } from '../metrics/weekly-summary.js';
import { readCsv } from './read-csv.js';

const RUN_FOLDER = /^(\d{4}-\d{2}-\d{2})-(\d+)$/;

async function readRunReports(runDir: string): Promise<Partial<ByPeriodReports>> {
  const reports: Partial<ByPeriodReports> = {};
  for (const [key, { file, columns, olderColumns }] of Object.entries(BY_PERIOD_REPORTS)) {
    try {
      reports[key as keyof ByPeriodReports] = await readCsv(
        join(runDir, file),
        columns,
        olderColumns,
      );
    } catch (error) {
      // A run stored without one of the files supplies no weeks; combineHistory handles that.
      if (!(error instanceof Error && error.message.startsWith('Missing CSV file:'))) {
        throw error;
      }
    }
  }
  return reports;
}

// Reads stored runs laid out as <historyDir>/<YYYY-MM-DD>-<run id>/, oldest folder name first. Only the
// four by-period CSVs are read: the detail CSVs hold issue text, and the page is public.
export async function readHistory(historyDir: string): Promise<StoredRun[]> {
  const entries = await readdir(historyDir, { withFileTypes: true });
  const runFolders = entries
    .filter((entry) => entry.isDirectory() && RUN_FOLDER.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (runFolders.length === 0) {
    throw new Error(`No stored DORA runs (YYYY-MM-DD-<run id> folders) in ${historyDir}`);
  }

  return Promise.all(
    runFolders.map(async (folder) => {
      const [, runDate, runId] = RUN_FOLDER.exec(folder) as RegExpExecArray;
      return {
        runDate,
        runId: Number(runId),
        reports: await readRunReports(join(historyDir, folder)),
      };
    }),
  );
}
