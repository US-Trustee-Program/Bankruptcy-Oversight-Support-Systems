import { describe, test, expect } from 'vitest';
import {
  slowestTests,
  topN,
  perFileTotals,
  overheadGaps,
  marginsToTimeout,
  buildReport,
  renderMarkdown,
  renderConsoleTable,
  type VitestJson,
} from './report.js';

// A minimal but realistic slice of the Vitest JSON shape. Real samples have many
// more fields (see temp/constrained-test/common-results.json); we only model the
// fields the pure report functions actually read.
function fixture(): VitestJson {
  return {
    testResults: [
      {
        name: '/workspace/common/src/a.test.ts',
        startTime: 1000,
        endTime: 1020,
        assertionResults: [
          { duration: 5, fullName: 'a suite first', title: 'first' },
          { duration: 12, fullName: 'a suite second', title: 'second' },
        ],
      },
      {
        name: '/workspace/common/src/b.test.ts',
        startTime: 2000,
        endTime: 2008,
        assertionResults: [{ duration: 3, fullName: 'b suite only', title: 'only' }],
      },
    ],
  };
}

describe('slowestTests', () => {
  test('produces a flat list sorted descending by ms with stripped file paths', () => {
    const result = slowestTests(fixture());

    expect(result).toEqual([
      { ms: 12, file: 'common/src/a.test.ts', title: 'a suite second' },
      { ms: 5, file: 'common/src/a.test.ts', title: 'a suite first' },
      { ms: 3, file: 'common/src/b.test.ts', title: 'b suite only' },
    ]);
  });

  test('degrades a missing or null duration to zero and keeps ties', () => {
    const report: VitestJson = {
      testResults: [
        {
          name: '/workspace/c.test.ts',
          assertionResults: [
            { duration: null, fullName: 'no duration', title: 'a' },
            { fullName: 'undefined duration', title: 'b' },
            { duration: 7, fullName: 'tie one', title: 'c' },
            { duration: 7, fullName: 'tie two', title: 'd' },
          ],
        },
      ],
    };

    const result = slowestTests(report);

    expect(result.map((r) => r.ms)).toEqual([7, 7, 0, 0]);
    // both zero-duration tests survive (no dropping), both ties present
    expect(result.filter((r) => r.ms === 0)).toHaveLength(2);
    expect(result.filter((r) => r.ms === 7)).toHaveLength(2);
  });

  test('returns an empty list for empty input', () => {
    expect(slowestTests({})).toEqual([]);
    expect(slowestTests({ testResults: [] })).toEqual([]);
  });
});

describe('topN', () => {
  test('slices the first n entries of an already-sorted list', () => {
    const rows = slowestTests(fixture());

    expect(topN(rows, 2)).toEqual([
      { ms: 12, file: 'common/src/a.test.ts', title: 'a suite second' },
      { ms: 5, file: 'common/src/a.test.ts', title: 'a suite first' },
    ]);
  });

  test('returns all entries when n exceeds the list length', () => {
    const rows = slowestTests(fixture());
    expect(topN(rows, 99)).toHaveLength(3);
  });
});

describe('perFileTotals', () => {
  test('sums each file’s test durations independently, slowest file first', () => {
    const result = perFileTotals(fixture());

    expect(result).toEqual([
      { file: 'common/src/a.test.ts', totalMs: 17, testCount: 2 },
      { file: 'common/src/b.test.ts', totalMs: 3, testCount: 1 },
    ]);
  });

  test('returns an empty list for empty input', () => {
    expect(perFileTotals({})).toEqual([]);
  });
});

describe('overheadGaps', () => {
  test('computes wall time minus summed test durations per file, largest gap first', () => {
    // a: wall 20, tests 17 => gap 3.  b: wall 8, tests 3 => gap 5.
    const result = overheadGaps(fixture());

    expect(result).toEqual([
      { file: 'common/src/b.test.ts', wallMs: 8, testMs: 3, gapMs: 5 },
      { file: 'common/src/a.test.ts', wallMs: 20, testMs: 17, gapMs: 3 },
    ]);
  });

  test('degrades to null wall time and null gap when a timing field is absent', () => {
    const report: VitestJson = {
      testResults: [
        {
          name: '/workspace/no-timing.test.ts',
          // startTime/endTime intentionally omitted
          assertionResults: [{ duration: 4, fullName: 'x', title: 'x' }],
        },
      ],
    };

    expect(overheadGaps(report)).toEqual([
      { file: 'no-timing.test.ts', wallMs: null, testMs: 4, gapMs: null },
    ]);
  });
});

describe('marginsToTimeout', () => {
  const report: VitestJson = {
    testResults: [
      {
        name: '/workspace/m.test.ts',
        assertionResults: [
          { duration: 100, fullName: 'fast', title: 'fast' },
          { duration: 4900, fullName: 'near limit', title: 'near limit' },
          { duration: 5200, fullName: 'over limit', title: 'over limit' },
          { duration: 4500, fullName: 'mid', title: 'mid' },
        ],
      },
    ],
  };

  test('uses the supplied timeout (not a hardcoded value) for margin = timeout - duration', () => {
    const result = marginsToTimeout(report, 5000);
    const near = result.find((r) => r.title === 'near limit');
    expect(near?.marginMs).toBe(100);

    // A different timeout yields a different margin — proving it is a parameter.
    const tighter = marginsToTimeout(report, 4600);
    const nearTighter = tighter.find((r) => r.title === 'near limit');
    expect(nearTighter?.marginMs).toBe(-300);
  });

  test('orders most-at-risk first: over-timeout (negative) then smallest positive margin', () => {
    const result = marginsToTimeout(report, 5000);

    expect(result.map((r) => ({ title: r.title, marginMs: r.marginMs }))).toEqual([
      { title: 'over limit', marginMs: -200 }, // already over the timeout
      { title: 'near limit', marginMs: 100 }, // smallest positive margin
      { title: 'mid', marginMs: 500 },
      { title: 'fast', marginMs: 4900 }, // most headroom, lowest priority
    ]);
  });
});

describe('buildReport', () => {
  test('assembles all four computations plus metadata', () => {
    const report = buildReport(fixture(), { workspace: 'common', top: 2, timeoutMs: 5000 });

    expect(report.workspace).toBe('common');
    expect(report.timeoutMs).toBe(5000);
    expect(report.totalTests).toBe(3);
    expect(report.totalTestMs).toBe(20); // 5 + 12 + 3, summed across all tests
    expect(report.slowest).toHaveLength(2); // top N applied
    expect(report.perFile).toHaveLength(2);
    expect(report.overhead).toHaveLength(2);
    expect(report.margins).toHaveLength(3); // every test, not sliced
    // margins ordered most-at-risk first
    expect(report.margins[0].marginMs).toBeLessThanOrEqual(report.margins[1].marginMs);
  });

  test('sums totalTestMs across ALL tests, not just the sliced top N', () => {
    // top: 1 keeps only the slowest test (12ms) in `slowest`, but totalTestMs
    // must still reflect every test (5 + 12 + 3 = 20). A refactor that summed
    // the sliced list instead would yield 12 and fail here.
    const report = buildReport(fixture(), { workspace: 'common', top: 1, timeoutMs: 5000 });

    expect(report.slowest).toHaveLength(1);
    expect(report.slowest[0].ms).toBe(12); // the only sliced row
    expect(report.totalTestMs).toBe(20); // full sum, NOT the top-1 sum of 12
  });
});

describe('renderMarkdown', () => {
  test('renders headed tables for each section and shows null gaps as a dash', () => {
    const report = buildReport(fixture(), { workspace: 'common', top: 5, timeoutMs: 5000 });
    const md = renderMarkdown(report);

    expect(md).toContain('# Constrained test report: common');
    expect(md).toContain('## Slowest tests');
    expect(md).toContain('## Per-file total time');
    expect(md).toContain('## Overhead gap');
    expect(md).toContain('## Margin to timeout (5000ms)');
    expect(md).toContain('a suite second');
    // file/title content makes it into the table
    expect(md).toContain('common/src/a.test.ts');
    // ends with a trailing newline
    expect(md.endsWith('\n')).toBe(true);
  });

  test('shows a dash for a null overhead gap rather than crashing', () => {
    const report = buildReport(
      { testResults: [{ name: '/workspace/x.test.ts', assertionResults: [{ duration: 1 }] }] },
      { workspace: 'common', top: 5, timeoutMs: 5000 },
    );
    expect(renderMarkdown(report)).toContain('| — |');
  });

  test('summary line reflects totalTestMs: N tests and total test time in seconds', () => {
    // fixture totals 20ms across 3 tests => "3 tests, 0.0s of test time total".
    const report = buildReport(fixture(), { workspace: 'common', top: 5, timeoutMs: 5000 });
    const md = renderMarkdown(report);

    expect(md).toContain('3 tests,');
    expect(md).toContain('0.0s of test time total');
  });
});

describe('renderConsoleTable', () => {
  test('renders each row as right-aligned ms, then file › title', () => {
    const report = buildReport(fixture(), { workspace: 'common', top: 5, timeoutMs: 5000 });
    const output = renderConsoleTable(report);
    const firstRow = output.split('\n')[0];

    // The slowest test (12ms) leads; ms is right-aligned, file and title joined by ' › '.
    expect(firstRow).toContain('12 ms');
    expect(firstRow).toContain('common/src/a.test.ts');
    expect(firstRow).toContain('  ›  ');
    expect(firstRow).toContain('a suite second');
  });

  test('appends a summary line with the test count and total test time', () => {
    // fixture totals 20ms across 3 tests => "3 tests, 0.0s of test time total".
    const report = buildReport(fixture(), { workspace: 'common', top: 5, timeoutMs: 5000 });
    const output = renderConsoleTable(report);

    expect(output).toContain('3 tests,');
    expect(output).toContain('0.0s of test time total');
  });

  test('shows an em-dash for a null/undefined-duration row without throwing', () => {
    // duration omitted => durationMs degrades to 0, but render the null path
    // explicitly by feeding a slowest row whose ms is null via a crafted report.
    const report = buildReport(
      { testResults: [{ name: '/workspace/n.test.ts', assertionResults: [{ title: 'no dur' }] }] },
      { workspace: 'common', top: 5, timeoutMs: 5000 },
    );
    // Force the null-duration display path at the rendering boundary.
    report.slowest = [{ ms: null as unknown as number, file: 'n.test.ts', title: 'no dur' }];

    let output = '';
    expect(() => {
      output = renderConsoleTable(report);
    }).not.toThrow();
    expect(output.split('\n')[0]).toContain('— ms');
  });
});
