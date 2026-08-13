import { readFileSync } from 'fs';
import path from 'path';

const CASE_DETAIL_SCREEN_PATH = path.resolve(__dirname, './CaseDetailScreen.tsx');
const WORKBOOK_PATH = path.resolve(
  __dirname,
  '../../../ops/cloud-deployment/lib/workbooks/docket-filter-metrics.json',
);

// Docket Filters Combination Cleared is deliberately undocumented in any KQL query — it carries
// no properties, and no query has been requested for its Cleared side (see
// docket-filter-usage-tracking.slice-4-implementation-notes.md). It is still mentioned in the
// workbook header's instrumented-events list, so it isn't fully invisible to a workbook reader.
const EVENT_NAMES_NOT_REQUIRED_IN_WORKBOOK = new Set(['Docket Filters Combination Cleared']);

describe('docket filter telemetry event names stay in sync with the workbook', () => {
  test('every Docket*Changed/Cleared event name fired in CaseDetailScreen.tsx is referenced in docket-filter-metrics.json', () => {
    const caseDetailScreenSource = readFileSync(CASE_DETAIL_SCREEN_PATH, 'utf8');
    const workbookSource = readFileSync(WORKBOOK_PATH, 'utf8');

    const eventNamesInCode = [
      ...new Set([...caseDetailScreenSource.matchAll(/'(Docket [^']+)'/g)].map((m) => m[1])),
    ];

    expect(eventNamesInCode.length).toBeGreaterThan(0);

    const missingFromWorkbook = eventNamesInCode.filter(
      (name) => !EVENT_NAMES_NOT_REQUIRED_IN_WORKBOOK.has(name) && !workbookSource.includes(name),
    );

    expect(missingFromWorkbook).toEqual([]);
  });
});
