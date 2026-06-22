// PURE computation for the constrained-test reporter. NO I/O lives here: no fs,
// no process.argv, no console. The CLI wrapper (report.cli.ts) reads the Vitest
// JSON, calls these functions, and writes the outputs. Keeping this module pure
// is what makes report.test.ts fast and mock-free.

/** One test assertion as Vitest emits it (only the fields we read are modeled). */
export interface VitestAssertion {
  duration?: number | null;
  fullName?: string;
  title?: string;
}

/** One file's worth of results. Wall time = endTime - startTime. */
export interface VitestFileResult {
  name?: string;
  startTime?: number;
  endTime?: number;
  assertionResults?: VitestAssertion[];
}

/** Top-level Vitest JSON reporter shape (subset). */
export interface VitestJson {
  testResults?: VitestFileResult[];
}

/** A single test's duration, sortable across all files. */
export interface SlowTest {
  ms: number;
  file: string;
  title: string;
}

// Strip the container's bind-mount prefix so reported paths are repo-relative.
function stripWorkspace(name: string): string {
  return name.replace(/^\/workspace\//, '');
}

// A missing or null duration degrades to 0 rather than throwing — Vitest can
// omit it (e.g. for a test that never actually ran), and a missing number must
// not poison the sort.
function durationMs(assertion: VitestAssertion): number {
  return assertion.duration ?? 0;
}

// fullName is the human-readable "<ancestors> <title>"; fall back to title.
function testTitle(assertion: VitestAssertion): string {
  return assertion.fullName ?? assertion.title ?? '';
}

/**
 * Every test as a flat list with its duration, repo-relative file, and title,
 * sorted slowest-first. These are RELATIVE rankings (compare tests to each
 * other within a run), not absolute wall-clock.
 */
export function slowestTests(report: VitestJson): SlowTest[] {
  const rows: SlowTest[] = [];
  for (const fileResult of report.testResults ?? []) {
    const file = stripWorkspace(fileResult.name ?? '');
    for (const assertion of fileResult.assertionResults ?? []) {
      rows.push({ ms: durationMs(assertion), file, title: testTitle(assertion) });
    }
  }
  rows.sort((a, b) => b.ms - a.ms);
  return rows;
}

/** First `n` entries of an already-ordered list (a "top N" slice). */
export function topN<T>(rows: T[], n: number): T[] {
  return rows.slice(0, n);
}

// Sum a file's reported test durations (each missing duration counts as 0).
function sumDurations(fileResult: VitestFileResult): number {
  return (fileResult.assertionResults ?? []).reduce((sum, a) => sum + durationMs(a), 0);
}

/** One file's total test time. */
export interface FileTotal {
  file: string;
  totalMs: number;
  testCount: number;
}

/**
 * Per-file sum of test durations, slowest file first. This is in-test time only
 * (no setup/transform overhead — that lives in the overhead gap below).
 */
export function perFileTotals(report: VitestJson): FileTotal[] {
  const totals: FileTotal[] = [];
  for (const fileResult of report.testResults ?? []) {
    totals.push({
      file: stripWorkspace(fileResult.name ?? ''),
      totalMs: sumDurations(fileResult),
      testCount: (fileResult.assertionResults ?? []).length,
    });
  }
  totals.sort((a, b) => b.totalMs - a.totalMs);
  return totals;
}

// Wall time is endTime - startTime. Either field can be absent (e.g. a file the
// reporter never timed); when so we report null rather than a bogus number.
function wallMs(fileResult: VitestFileResult): number | null {
  const { startTime, endTime } = fileResult;
  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    return null;
  }
  return endTime - startTime;
}

/** One file's setup/teardown overhead: wall time beyond its in-test time. */
export interface OverheadGap {
  file: string;
  wallMs: number | null;
  testMs: number;
  gapMs: number | null;
}

/**
 * Per-file overhead gap = (file wall time) - (sum of that file's test
 * durations). The remainder is setup/transform/teardown the suite paid outside
 * the assertions. Files missing timing degrade to null (gap unknown) and sort
 * last. Largest gap first.
 */
export function overheadGaps(report: VitestJson): OverheadGap[] {
  const gaps: OverheadGap[] = [];
  for (const fileResult of report.testResults ?? []) {
    const wall = wallMs(fileResult);
    const testMs = sumDurations(fileResult);
    gaps.push({
      file: stripWorkspace(fileResult.name ?? ''),
      wallMs: wall,
      testMs,
      gapMs: wall === null ? null : wall - testMs,
    });
  }
  // Null gaps (unknown) sort last; otherwise largest gap first.
  gaps.sort((a, b) => (b.gapMs ?? -Infinity) - (a.gapMs ?? -Infinity));
  return gaps;
}

/** One test's headroom against the effective per-test timeout. */
export interface TimeoutMargin {
  marginMs: number;
  ms: number;
  file: string;
  title: string;
}

/**
 * Per-test margin to the timeout = (effective per-test timeout) - (duration).
 * Ordered most-at-risk first: tests already over the timeout (margin <= 0) lead,
 * then the smallest positive margins (closest to timing out). The timeout is a
 * REQUIRED parameter — the CLI supplies it (default 5000ms) so report.ts never
 * hardcodes a policy value.
 */
export function marginsToTimeout(report: VitestJson, timeoutMs: number): TimeoutMargin[] {
  const margins: TimeoutMargin[] = slowestTests(report).map((row) => ({
    marginMs: timeoutMs - row.ms,
    ms: row.ms,
    file: row.file,
    title: row.title,
  }));
  // Ascending margin: negatives (over budget) first, then smallest positive.
  margins.sort((a, b) => a.marginMs - b.marginMs);
  return margins;
}

/** Knobs the CLI passes in; nothing here is hardcoded as policy. */
export interface ReportOptions {
  workspace: string;
  top: number;
  timeoutMs: number;
}

/** The full structured report — the machine-readable JSON the CLI persists. */
export interface ConstrainedTestReport {
  workspace: string;
  timeoutMs: number;
  totalTests: number;
  totalTestMs: number;
  slowest: SlowTest[];
  perFile: FileTotal[];
  overhead: OverheadGap[];
  margins: TimeoutMargin[];
}

/**
 * Assemble every computation into one structured result. `slowest` is sliced to
 * the top N for the console/Markdown view; `margins` keeps every test so the
 * at-risk ranking is complete.
 */
export function buildReport(report: VitestJson, options: ReportOptions): ConstrainedTestReport {
  const allSlowest = slowestTests(report);
  return {
    workspace: options.workspace,
    timeoutMs: options.timeoutMs,
    totalTests: allSlowest.length,
    totalTestMs: allSlowest.reduce((sum, row) => sum + row.ms, 0),
    slowest: topN(allSlowest, options.top),
    perFile: perFileTotals(report),
    overhead: overheadGaps(report),
    margins: marginsToTimeout(report, options.timeoutMs),
  };
}

// --- rendering (still pure: strings in, strings out, no I/O) ------------------

// Round to a whole millisecond for display; null/undefined renders as an em dash.
function ms(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(0);
}

function markdownTable(headers: string[], rows: string[][]): string {
  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((cells) => `| ${cells.join(' | ')} |`);
  return [headerLine, dividerLine, ...bodyLines].join('\n');
}

/**
 * Human-readable Markdown report: one table per computation. Pure — the CLI
 * writes the returned string to disk. Null overhead gaps render as a dash.
 */
export function renderMarkdown(report: ConstrainedTestReport): string {
  const sections = [
    `# Constrained test report: ${report.workspace}`,
    '',
    `${report.totalTests} tests, ${(report.totalTestMs / 1000).toFixed(1)}s of test time total. ` +
      'Rankings are RELATIVE (compare tests within this run), not absolute wall-clock.',
    '',
    '## Slowest tests',
    '',
    markdownTable(
      ['ms', 'file', 'test'],
      report.slowest.map((row) => [ms(row.ms), row.file, row.title]),
    ),
    '',
    '## Per-file total time',
    '',
    markdownTable(
      ['total ms', 'tests', 'file'],
      report.perFile.map((row) => [ms(row.totalMs), String(row.testCount), row.file]),
    ),
    '',
    '## Overhead gap',
    '',
    'Wall time beyond in-test time (setup/transform/teardown). Largest first; ' +
      'a dash means the file had no timing data; ' +
      'small negative or `-0` gaps are timer-resolution noise on very fast files and can be ignored.',
    '',
    markdownTable(
      ['gap ms', 'wall ms', 'test ms', 'file'],
      report.overhead.map((row) => [ms(row.gapMs), ms(row.wallMs), ms(row.testMs), row.file]),
    ),
    '',
    `## Margin to timeout (${report.timeoutMs}ms)`,
    '',
    'Per-test headroom against the effective timeout. Most-at-risk first ' +
      '(negative = already over the timeout).',
    '',
    markdownTable(
      ['margin ms', 'ms', 'file', 'test'],
      report.margins.map((row) => [ms(row.marginMs), ms(row.ms), row.file, row.title]),
    ),
    '',
  ];
  return sections.join('\n');
}

/**
 * Plain-text slowest-N table for stdout, preserving the original console
 * experience the inline reporter produced. Pure — the CLI prints it.
 */
export function renderConsoleTable(report: ConstrainedTestReport): string {
  const pad = (value: string, width: number) => value.padStart(width);
  const lines = report.slowest.map(
    (row) => `${pad(ms(row.ms), 7)} ms  ${row.file}  ›  ${row.title}`,
  );
  lines.push('');
  lines.push(
    `  ${report.totalTests} tests, ${(report.totalTestMs / 1000).toFixed(1)}s of test time total`,
  );
  return lines.join('\n');
}
