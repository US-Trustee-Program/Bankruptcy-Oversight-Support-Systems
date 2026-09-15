/**
 * AI second-opinion review of data/replay-backtest-report.csv (produced by
 * main-branch-replay-backtest.ts): for every ACMS record and its full candidate pool, spawns one
 * ISOLATED `claude -p` invocation per record to judge each candidate as "match"/"no-match", using
 * the actual name/address/phone data rather than the structured scores alone. One invocation per
 * record (never batched across records) so one trustee's candidate context can never bleed into
 * another's judgment.
 *
 * Prerequisites: data/replay-backtest-report.csv must already exist (run
 * main-branch-replay-backtest.ts first). Requires the `claude` CLI to be installed and
 * authenticated. Each `claude -p` call is spawned through an interactive `/bin/zsh -i -c` shell
 * with cwd pinned to the repo root rather than the bare binary, so any account-routing shell
 * function defined in .zshrc (interactive-only, path-based) still activates. Spawning the bare
 * binary directly can silently authenticate against the wrong backend/account.
 *
 * Usage (from test/integration/):
 *   npx tsx --tsconfig ../../backend/tsconfig.json \
 *     sync-acms-professional-ids-audit/scripts/ai-candidate-review.ts --shard=1 --of=4
 *
 * Run multiple shards in parallel (separate terminals/agents) to divide the work, e.g.:
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/ai-candidate-review.ts --shard=1 --of=4
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/ai-candidate-review.ts --shard=2 --of=4
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/ai-candidate-review.ts --shard=3 --of=4
 *   npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/ai-candidate-review.ts --shard=4 --of=4
 *
 * Each shard is independently resumable: if data/ai-review-shard-{N}-of-{M}.csv already exists,
 * acmsProfessionalId values already present in it are skipped and new results are appended, so an
 * interrupted run only re-does what's left.
 *
 * Override the input CSV path with REPLAY_BACKTEST_REPORT_CSV, following the same env-var
 * override convention main-branch-replay-backtest.ts uses for its own fixture paths. Override the
 * reviewing model with AI_REVIEW_MODEL (a full model name or CLI alias accepted by `claude
 * --model`); unset inherits the session/account default.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

const DATA_DIR = path.resolve(__dirname, '../../../../data');
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const PROMPT_TEMPLATE_PATH = path.resolve(__dirname, 'ai-candidate-review-prompt.md');

/**
 * Small, human-tunable concurrency cap for `claude -p` child processes running at once within a
 * single shard. Higher throughput trades off against hammering rate limits / burning through an
 * unmetered seat's concurrent-session allowance; lower is safer but slower across ~2734 records.
 * Tune this constant directly rather than adding a CLI flag — it's a machine/plan characteristic,
 * not something that should vary run-to-run.
 */
const CONCURRENCY = 4;

const PROGRESS_LOG_INTERVAL = 25;

const REPORT_COLUMNS = [
  'acmsProfessionalId',
  'introductionStage',
  'candidateOutcome',
  'acmsFullName',
  'camsName',
  'stateMatch',
  'nameScore',
  'fullNameSimilarity',
  'tokenNameMatchRate',
  'acmsAddress',
  'camsAddress',
  'addressScore',
  'acmsPhone',
  'camsPhone',
  'phoneScore',
  'camsTrusteeId',
  'notes',
] as const;

type ReportColumn = (typeof REPORT_COLUMNS)[number];
type CandidateRow = Record<ReportColumn, string>;

const OUTPUT_HEADER = [...REPORT_COLUMNS, 'aiVerdict', 'aiReason'];

type AiVerdict = 'match' | 'no-match';

type VerdictResult = {
  camsTrusteeId: string;
  verdict: AiVerdict;
  reason: string;
};

type VerdictResponse = {
  verdicts: VerdictResult[];
};

const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          camsTrusteeId: { type: 'string' },
          verdict: { type: 'string', enum: ['match', 'no-match'] },
          reason: { type: 'string' },
        },
        required: ['camsTrusteeId', 'verdict', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
};

/** RFC 4180-minimal parser: handles quoted fields, embedded commas, embedded newlines, and doubled
 * quotes-as-escape, which is all main-branch-replay-backtest.ts's csvEscape ever produces. Not a
 * general CSV library dependency since the input shape is fully controlled by that one writer. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvRowLine(fields: string[]): string {
  return fields.map(csvEscape).join(',') + '\n';
}

function readCandidateRows(csvPath: string): CandidateRow[] {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  const indexOf = new Map(header.map((col, i) => [col, i]));
  for (const col of REPORT_COLUMNS) {
    if (!indexOf.has(col)) {
      throw new Error(`${csvPath} is missing expected column "${col}"`);
    }
  }
  return rows.slice(1).map((raw) => {
    const record = {} as CandidateRow;
    for (const col of REPORT_COLUMNS) {
      record[col] = raw[indexOf.get(col)!] ?? '';
    }
    return record;
  });
}

/** Preserves input row order within each group (required by the grouping contract) by relying on
 * Map's insertion-order iteration rather than re-sorting. */
function groupByAcmsProfessionalId(rows: CandidateRow[]): Map<string, CandidateRow[]> {
  const groups = new Map<string, CandidateRow[]>();
  for (const row of rows) {
    const key = row.acmsProfessionalId;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

/**
 * Deterministic, dependency-free sharding: sort every distinct acmsProfessionalId with a plain
 * string sort, then slice into M contiguous near-equal partitions using the standard
 * "remainder-first" distribution (the first `total % of` partitions get one extra element). Given
 * the same CSV and the same `--of`, this always produces the same partition boundaries regardless
 * of which `--shard` is requested or what order records were read in, so independently-run shards
 * never overlap and never miss a record.
 */
function partitionIds(ids: string[], shard: number, of: number): string[] {
  const sorted = [...ids].sort();
  const total = sorted.length;
  const baseSize = Math.floor(total / of);
  const remainder = total % of;

  let start = 0;
  for (let n = 1; n < shard; n++) {
    start += baseSize + (n <= remainder ? 1 : 0);
  }
  const thisSize = baseSize + (shard <= remainder ? 1 : 0);
  return sorted.slice(start, start + thisSize);
}

type CliArgs = {
  shard: number;
  of: number;
};

function parseCliArgs(argv: string[]): CliArgs {
  let shard: number | undefined;
  let of: number | undefined;
  for (const arg of argv) {
    const shardMatch = arg.match(/^--shard=(\d+)$/);
    const ofMatch = arg.match(/^--of=(\d+)$/);
    if (shardMatch) shard = Number(shardMatch[1]);
    if (ofMatch) of = Number(ofMatch[1]);
  }
  if (shard === undefined || of === undefined) {
    throw new Error('Both --shard=N and --of=M are required, e.g. --shard=1 --of=4');
  }
  if (of < 1) {
    throw new Error(`--of must be >= 1, got ${of}`);
  }
  if (shard < 1 || shard > of) {
    throw new Error(`--shard must satisfy 1 <= shard <= of (got --shard=${shard} --of=${of})`);
  }
  return { shard, of };
}

function alreadyReviewedIds(outputPath: string): Set<string> {
  if (!fs.existsSync(outputPath)) return new Set();
  const rows = readCandidateRows(outputPath);
  return new Set(rows.map((r) => r.acmsProfessionalId));
}

/** Streams shard results one record's rows at a time, matching main-branch-replay-backtest.ts's
 * ReportWriter pattern. Opens in append mode so a resumed run adds to an existing partial shard
 * file instead of truncating already-reviewed records. */
class ShardReportWriter {
  private readonly stream: fs.WriteStream;

  constructor(outputPath: string, isResuming: boolean) {
    const isNewFile = !isResuming;
    this.stream = fs.createWriteStream(outputPath, { encoding: 'utf-8', flags: 'a' });
    if (isNewFile) {
      this.stream.write(csvRowLine(OUTPUT_HEADER));
    }
  }

  writeRecord(rows: CandidateRow[], verdictsByTrusteeId: Map<string, VerdictResult>): void {
    for (const row of rows) {
      const verdict = verdictsByTrusteeId.get(row.camsTrusteeId);
      const fields = REPORT_COLUMNS.map((col) => row[col]);
      fields.push(verdict?.verdict ?? '', verdict?.reason ?? '');
      this.stream.write(csvRowLine(fields));
    }
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }
}

function formatAcmsRecord(row: CandidateRow): string {
  return [
    `Full name: ${row.acmsFullName || '(blank)'}`,
    `Address: ${row.acmsAddress || '(blank)'}`,
    `Phone: ${row.acmsPhone || '(blank)'}`,
  ].join('\n');
}

function formatCandidate(row: CandidateRow, index: number): string {
  return [
    `### Candidate ${index + 1}`,
    `camsTrusteeId: ${row.camsTrusteeId}`,
    `Name: ${row.camsName || '(blank)'}`,
    `Address: ${row.camsAddress || '(blank)'}`,
    `Phone: ${row.camsPhone || '(blank)'}`,
    `Structured signals: nameScore=${row.nameScore}, fullNameSimilarity=${row.fullNameSimilarity}, ` +
      `tokenNameMatchRate=${row.tokenNameMatchRate}, stateMatch=${row.stateMatch}, ` +
      `addressScore=${row.addressScore}, phoneScore=${row.phoneScore}`,
    `introductionStage: ${row.introductionStage}, candidateOutcome: ${row.candidateOutcome}`,
  ].join('\n');
}

function buildPrompt(template: string, rows: CandidateRow[]): string {
  const acmsRecord = formatAcmsRecord(rows[0]);
  const candidates = rows.map((row, i) => formatCandidate(row, i)).join('\n\n');
  return template.replace('{{ACMS_RECORD}}', acmsRecord).replace('{{CANDIDATES}}', candidates);
}

/**
 * Invoked via an interactive `/bin/zsh -i -c` wrapper rather than calling the `claude` binary
 * directly, because on developer machines `claude` is commonly a shell function (sourced from
 * .zshrc, active only in an interactive shell) that routes each invocation to the correct
 * flat-rate account based on which repo the cwd resolves to. execFile spawning the bare binary
 * bypasses that function entirely — it never sources .zshrc — and silently falls through to
 * whatever default backend is on PATH, which is not the intended account. Running through an
 * interactive zsh makes the router activate exactly as it would from a terminal, and `cwd` is
 * pinned to the repo root (not /tmp or the script's own directory) since the router's account
 * selection is path-based.
 *
 * The `claude` flags/schema are script-controlled constants, not attacker/data-controlled, so
 * embedding them in the `-c` string is safe; only the prompt itself carries real, externally-
 * sourced ACMS data, and that is never interpolated into the command — it is piped over stdin
 * to the spawned shell exactly as it would be to a bare execFile call.
 */
function runClaudeReview(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudeCommand = [
      'claude',
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      `'${JSON.stringify(VERDICT_JSON_SCHEMA).replaceAll("'", `'\\''`)}'`,
      ...(process.env.AI_REVIEW_MODEL ? ['--model', process.env.AI_REVIEW_MODEL] : []),
    ].join(' ');
    const child = execFile(
      '/bin/zsh',
      ['-i', '-c', claudeCommand],
      { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`claude -p failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout);
      },
    );
    child.stdin!.write(prompt);
    child.stdin!.end();
  });
}

/** `claude -p --output-format json` wraps the model's final answer in an envelope with run
 * metadata (cost, session id, etc.); the actual response text/JSON is in `result`. Parsed
 * defensively since a malformed or budget/timeout-truncated response must be treated as a
 * per-record failure, not crash the shard. */
function extractVerdicts(claudeStdout: string): VerdictResult[] {
  const envelope = JSON.parse(claudeStdout) as { result?: unknown; is_error?: boolean };
  if (envelope.is_error) {
    throw new Error(`claude -p reported an error result: ${JSON.stringify(envelope.result)}`);
  }
  const result = envelope.result;
  const parsed: VerdictResponse =
    typeof result === 'string' ? (JSON.parse(result) as VerdictResponse) : (result as VerdictResponse);
  if (!parsed || !Array.isArray(parsed.verdicts)) {
    throw new Error('claude -p response did not contain a verdicts array');
  }
  return parsed.verdicts;
}

/** Bounded-concurrency worker pool: runs `worker` over `items` with at most `concurrency` in
 * flight at once. A hand-rolled loop rather than a dependency since the need is this narrow — N
 * async tasks, fixed pool size, no queueing priorities or backpressure beyond the pool size. */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex++;
      await worker(item);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(workers);
}

async function run(): Promise<void> {
  const { shard, of } = parseCliArgs(process.argv.slice(2));

  const inputCsvPath =
    process.env.REPLAY_BACKTEST_REPORT_CSV ?? path.join(DATA_DIR, 'replay-backtest-report.csv');
  if (!fs.existsSync(inputCsvPath)) {
    throw new Error(
      `${inputCsvPath} does not exist. Run main-branch-replay-backtest.ts first, or set ` +
        'REPLAY_BACKTEST_REPORT_CSV to point at an existing report.',
    );
  }

  const promptTemplate = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');

  const allRows = readCandidateRows(inputCsvPath);
  const groups = groupByAcmsProfessionalId(allRows);
  const allIds = [...groups.keys()];
  const shardIds = partitionIds(allIds, shard, of);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outputPath = path.join(DATA_DIR, `ai-review-shard-${shard}-of-${of}.csv`);
  const alreadyDone = alreadyReviewedIds(outputPath);
  const remainingIds = shardIds.filter((id) => !alreadyDone.has(id));

  console.log(
    `shard ${shard}/${of}: ${shardIds.length} records assigned, ${alreadyDone.size} already ` +
      `reviewed (resuming), ${remainingIds.length} remaining\n`,
  );

  const writer = new ShardReportWriter(outputPath, alreadyDone.size > 0);

  let completed = 0;
  let matchCount = 0;
  let noMatchCount = 0;
  const erroredIds: string[] = [];

  await runWithConcurrency(remainingIds, CONCURRENCY, async (acmsProfessionalId) => {
    const rows = groups.get(acmsProfessionalId)!;
    try {
      const prompt = buildPrompt(promptTemplate, rows);
      const stdout = await runClaudeReview(prompt);
      const verdicts = extractVerdicts(stdout);
      const verdictsByTrusteeId = new Map(verdicts.map((v) => [v.camsTrusteeId, v]));
      // A response covering fewer candidates than the record actually has (the model truncated,
      // skipped some, or otherwise gave a partial answer) must be treated as a full failure, not
      // partially written - writing blanks for the uncovered rows would silently and permanently
      // lose those candidates, since a record only ever gets retried on resume when it's NOT
      // already present in the output file at all.
      const missingIds = rows
        .map((row) => row.camsTrusteeId)
        .filter((id) => !verdictsByTrusteeId.has(id));
      if (missingIds.length > 0) {
        throw new Error(
          `claude -p response covered ${verdicts.length}/${rows.length} candidates, missing ` +
            `${missingIds.length}: ${missingIds.slice(0, 5).join(', ')}${missingIds.length > 5 ? '...' : ''}`,
        );
      }
      writer.writeRecord(rows, verdictsByTrusteeId);
      for (const v of verdicts) {
        if (v.verdict === 'match') matchCount++;
        else noMatchCount++;
      }
    } catch (error) {
      erroredIds.push(acmsProfessionalId);
      console.error(
        `  error reviewing acmsProfessionalId=${acmsProfessionalId}: ${(error as Error).message}`,
      );
    } finally {
      completed++;
      if (completed % PROGRESS_LOG_INTERVAL === 0) {
        console.log(`shard ${shard}/${of}: ${completed}/${remainingIds.length} records reviewed`);
      }
    }
  });

  await writer.close();

  console.log(`\n=== shard ${shard}/${of} summary ===`);
  console.log(`  records reviewed:  ${completed - erroredIds.length}`);
  console.log(`  verdicts match:    ${matchCount}`);
  console.log(`  verdicts no-match: ${noMatchCount}`);
  if (erroredIds.length > 0) {
    console.log(`  records errored (will retry on next run): ${erroredIds.length}`);
    for (const id of erroredIds) console.log(`    ${id}`);
  } else {
    console.log('  records errored: 0');
  }
  console.log(`\nWrote results to ${outputPath}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
