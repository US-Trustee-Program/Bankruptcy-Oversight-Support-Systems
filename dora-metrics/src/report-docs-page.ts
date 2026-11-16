import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  BY_PERIOD_REPORTS,
  type ByPeriodReports,
  summarizeLatestWeek,
} from './metrics/weekly-summary.js';
import { readCsv } from './output/read-csv.js';
import { type DocsPageContext, renderDocsPage } from './output/render-docs-page.js';

const DATA_DIR = 'data';
const OUTPUT_PATH = 'data/dora-metrics.md';

function resolveRun(): DocsPageContext['run'] {
  const { GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
  if (!GITHUB_RUN_ID || !GITHUB_SERVER_URL || !GITHUB_REPOSITORY) {
    return undefined;
  }
  return {
    id: GITHUB_RUN_ID,
    url: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  };
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

  const summary = summarizeLatestWeek(reports, generatedAt);
  const page = renderDocsPage(summary, { generatedAt, run: resolveRun() });

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
