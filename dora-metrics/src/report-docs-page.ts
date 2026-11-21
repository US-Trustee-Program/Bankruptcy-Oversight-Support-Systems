import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  BY_PERIOD_REPORTS,
  type ByPeriodReports,
  summarizeSettledWeeks,
} from './metrics/weekly-summary.js';
import { readCsv } from './output/read-csv.js';
import { renderDocsPage } from './output/render-docs-page.js';
import { resolveRun } from './output/resolve-run.js';

const DATA_DIR = 'data';
const OUTPUT_PATH = 'data/dora-metrics.md';

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
  const summaries = summarizeSettledWeeks(reports, generatedAt);
  const summary = summaries[summaries.length - 1];
  const page = renderDocsPage(summary, { generatedAt, run: resolveRun(process.env) });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, page, 'utf8');

  console.log(
    `DORA docs page: week starting ${summary.periodStart.toISOString()}. Wrote ${OUTPUT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
