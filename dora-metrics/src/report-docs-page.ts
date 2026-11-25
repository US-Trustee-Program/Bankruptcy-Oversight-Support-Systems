import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { combineHistory, type HistoryWeek } from './metrics/history.js';
import {
  BY_PERIOD_REPORTS,
  type ByPeriodReports,
  summarizeSettledWeeks,
} from './metrics/weekly-summary.js';
import { readCsv } from './output/read-csv.js';
import { readHistory } from './output/read-history.js';
import { renderDocsPage } from './output/render-docs-page.js';
import { renderSlackHeadline } from './output/render-slack-headline.js';
import { resolveRun } from './output/resolve-run.js';

const DATA_DIR = 'data';
const OUTPUT_PATH = 'data/dora-metrics.md';
const HEADLINE_PATH = 'data/dora-slack-headline.txt';

// DORA_HISTORY_DIR holds runs downloaded from storage as <dir>/<YYYY-MM-DD>-<run id>/. Unset (a local or
// branch run), the page has no long-term section. Set, it must hold at least one run, or the page fails.
async function readLongTermTrend(
  reports: ByPeriodReports,
  generatedAt: Date,
): Promise<HistoryWeek[]> {
  const historyDir = process.env.DORA_HISTORY_DIR;
  if (historyDir === undefined) {
    return [];
  }
  return combineHistory(await readHistory(historyDir), { reports, generatedAt });
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const entries = await Promise.all(
    Object.entries(BY_PERIOD_REPORTS).map(
      async ([key, { file, columns }]) =>
        [key, await readCsv(join(DATA_DIR, file), columns)] as const,
    ),
  );
  const reports = Object.fromEntries(entries) as ByPeriodReports;

  // Oldest first, so the newest settled week is the headline.
  const weeks = summarizeSettledWeeks(reports, generatedAt);
  const headline = weeks[weeks.length - 1];
  const history = await readLongTermTrend(reports, generatedAt);
  const page = renderDocsPage(weeks, { generatedAt, run: resolveRun(process.env) }, history);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, page, 'utf8');
  await writeFile(HEADLINE_PATH, renderSlackHeadline(headline), 'utf8');

  console.log(
    `DORA docs page: week starting ${headline.periodStart.toISOString()}, ${weeks.length} weeks in the trend, ${history.length} in the long-term trend. Wrote ${OUTPUT_PATH} and ${HEADLINE_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
