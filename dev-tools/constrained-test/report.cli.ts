// THIN CLI wrapper for the constrained-test reporter. All logic lives in the
// pure report.ts; this file is just I/O + wiring (read JSON, call report.ts,
// write outputs, print the table) and is intentionally NOT unit-tested.
//
// Usage (run on the HOST via tsx, after the container wrote the Vitest JSON):
//   tsx report.cli.ts <vitest-json-path> <workspace> <top> <timeoutMs> [--profiled]
// e.g.
//   tsx report.cli.ts temp/constrained-test/common-results.json common 25 5000

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { buildReport, renderMarkdown, renderConsoleTable, type VitestJson } from './report.js';

// `--profiled` is an order-independent flag: pull it out first, then read the 4
// positionals from what remains so the existing positional contract the bash
// script relies on is unchanged when the flag is absent.
const rawArgs = process.argv.slice(2);
const profiled = rawArgs.includes('--profiled');
const [jsonPath, workspace, topArg, timeoutArg] = rawArgs.filter((arg) => arg !== '--profiled');

if (!jsonPath || !workspace) {
  console.error(
    'usage: report.cli.ts <vitest-json-path> <workspace> [top] [timeoutMs] [--profiled]',
  );
  process.exit(2);
}

const top = Number.parseInt(topArg ?? '25', 10);
// Effective per-test timeout default stays 5000ms; the pure function never
// hardcodes it, so the policy value lives here at the edge.
const timeoutMs = Number.parseInt(timeoutArg ?? '5000', 10);

const vitestJson = JSON.parse(readFileSync(jsonPath, 'utf8')) as VitestJson;
const report = buildReport(vitestJson, { workspace, top, timeoutMs, profiled });

// Persist both formats next to the input JSON (temp/constrained-test/). The
// names deliberately differ from the input "${workspace}-results.json" so they
// never collide.
const outDir = dirname(jsonPath);
mkdirSync(outDir, { recursive: true });

const jsonReportPath = join(outDir, `${workspace}-report.json`);
const markdownReportPath = join(outDir, `${workspace}-report.md`);

writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(markdownReportPath, renderMarkdown(report), 'utf8');

// Preserve the original console experience: the slowest-N table to stdout.
console.log(renderConsoleTable(report));
console.log(`\n  JSON report:     ${jsonReportPath}`);
console.log(`  Markdown report: ${markdownReportPath}`);
