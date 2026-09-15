/**
 * AI second-opinion review of data/replay-backtest-report.jsonl (produced by
 * pipeline-replay-backtest.ts): for every ACMS record and its full candidate pool, spawns one
 * ISOLATED `claude -p` invocation per record to judge each candidate as "match"/"no-match", using
 * the actual name/address/phone data rather than the structured scores alone. One invocation per
 * record (never batched across records) so one trustee's candidate context can never bleed into
 * another's judgment.
 *
 * Reads the JSONL directly (the full serialized pipeline state per record) rather than the
 * flattened CSV - the CSV only ever carries the WINNING candidate's corroboration score and a
 * single "introductionStage" label; the JSONL carries every scorer's contribution for every
 * candidate (see ScoreByScorer), so the prompt built from it can show the model the complete
 * evaluation history, not just whichever scorer happened to run last.
 *
 * Prerequisites: data/replay-backtest-report.jsonl must already exist (run
 * pipeline-replay-backtest.ts first). Requires the `claude` CLI to be installed and authenticated.
 * Each `claude -p` call is spawned through an interactive `/bin/zsh -i -c` shell with cwd pinned to
 * the repo root rather than the bare binary, so any account-routing shell function defined in
 * .zshrc (interactive-only, path-based) still activates. Spawning the bare binary directly can
 * silently authenticate against the wrong backend/account.
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
 * Each shard is independently resumable: if its output CSV already exists, acmsProfessionalId
 * values already present in it are skipped and new results are appended, so an interrupted run
 * only re-does what's left.
 *
 * Every shard writes a flattened CSV for human review (one row per record/candidate pair, plus
 * aiVerdict/aiReason) - the same shape the old CSV-driven version produced, still derived fresh
 * from each JSONL line rather than carried over from any prior CSV.
 *
 * By default only screens UNRESOLVED records (record.match === null) - pattern-hunting for new
 * matcher gaps only needs the population the pipeline didn't already auto-resolve, so screening
 * the resolved population too would just re-confirm already-trusted answers at real cost. Pass
 * --unresolved-only=false to run a full false-positive sweep across EVERY record (including
 * already-resolved ones) instead - a separate, more expensive pass, intended for later once
 * obvious matcher gaps have already been addressed. The two modes write to different files
 * (data/ai-review-unresolved-shard-{N}-of-{M}.csv vs. data/ai-review-full-shard-{N}-of-{M}.csv) so
 * they never collide or get resumed into each other by mistake.
 *
 * Override the input JSONL path with REPLAY_BACKTEST_REPORT_JSONL, following the same env-var
 * override convention pipeline-replay-backtest.ts uses for its own fixture paths. Override the
 * reviewing model with AI_REVIEW_MODEL (a full model name or CLI alias accepted by `claude
 * --model`); unset inherits the session/account default.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import {
  MemoEntry,
  ProjectedTrustee,
  ScoreByScorer,
  SerializedState,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match-pipeline';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';

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

type ReviewRecord = { acmsProfessionalId: string } & SerializedState;

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

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function csvRowLine(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(',') + '\n';
}

const REPORT_COLUMNS = [
  'acmsProfessionalId',
  'introductionStage',
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
] as const;

const OUTPUT_HEADER = [...REPORT_COLUMNS, 'aiVerdict', 'aiReason'];

function readReviewRecords(jsonlPath: string): ReviewRecord[] {
  const text = fs.readFileSync(jsonlPath, 'utf-8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ReviewRecord);
}

function alreadyReviewedIds(outputCsvPath: string): Set<string> {
  if (!fs.existsSync(outputCsvPath)) return new Set();
  const text = fs.readFileSync(outputCsvPath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return new Set();
  const ids = new Set<string>();
  for (const line of lines.slice(1)) {
    const commaIndex = line.indexOf(',');
    ids.add(commaIndex === -1 ? line : line.slice(0, commaIndex).replace(/^"|"$/g, ''));
  }
  return ids;
}

/**
 * Deterministic, dependency-free sharding: sort every distinct acmsProfessionalId with a plain
 * string sort, then slice into M contiguous near-equal partitions using the standard
 * "remainder-first" distribution (the first `total % of` partitions get one extra element). Given
 * the same JSONL and the same `--of`, this always produces the same partition boundaries
 * regardless of which `--shard` is requested or what order records were read in, so
 * independently-run shards never overlap and never miss a record.
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
  unresolvedOnly: boolean;
};

function parseCliArgs(argv: string[]): CliArgs {
  let shard: number | undefined;
  let of: number | undefined;
  let unresolvedOnly = true;
  for (const arg of argv) {
    const shardMatch = arg.match(/^--shard=(\d+)$/);
    const ofMatch = arg.match(/^--of=(\d+)$/);
    const unresolvedOnlyMatch = arg.match(/^--unresolved-only=(true|false)$/);
    if (shardMatch) shard = Number(shardMatch[1]);
    if (ofMatch) of = Number(ofMatch[1]);
    if (unresolvedOnlyMatch) unresolvedOnly = unresolvedOnlyMatch[1] === 'true';
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
  return { shard, of, unresolvedOnly };
}

function acmsAddressString(acmsRaw: DxtrTrusteeParty): string {
  return [acmsRaw.legacy?.address1, acmsRaw.legacy?.cityStateZipCountry].filter(Boolean).join(', ');
}

function camsAddressString(candidate: ProjectedTrustee): string {
  const a = candidate.address;
  if (!a) return '';
  return [a.address1, [a.city, a.state, a.zipCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

function mergeScores(scores: ScoreByScorer): Record<string, unknown> {
  return Object.assign({}, ...Object.values(scores));
}

/** Whichever scorer most recently touched this candidate - purely a display label, matching
 * pipeline-replay-backtest.ts's own convention. */
function introductionStageOf(scores: ScoreByScorer): string {
  const names = Object.keys(scores);
  return names[names.length - 1] ?? 'unknown';
}

/** Reads the most recently cached call's value for a normalizer function out of a serialized
 * NormalizedMemo (see trustee-match-pipeline.ts) - camsNormalized[functionName] is an array of
 * every distinct-fingerprint call made against this candidate (see MemoEntry), not a single bare
 * value, since a normalizer CAN be called more than once with different inputs. This reviewer only
 * ever displays a candidate's OWN latest fullNameSimilarity/tokenNameMatchRate, so the last entry
 * is the one that matters here. */
function latestMemoValue(
  camsNormalized: Record<string, MemoEntry[]>,
  functionName: string,
): unknown {
  const entries = camsNormalized[functionName];
  return entries?.[entries.length - 1]?.value;
}

/** Derives one flattened CSV row's worth of display fields for a single candidate, merging in the
 * winning candidate's corroboration score (see PipelineMatch.score) the same way
 * pipeline-replay-backtest.ts does, since that score is never written through addScore onto
 * candidate.scores itself. */
function deriveCandidateFields(
  record: ReviewRecord,
  candidate: ReviewRecord['candidates'][number],
) {
  const isWinner = candidate.camsRaw.trusteeId === record.match?.trusteeId;
  const merged = {
    ...mergeScores(candidate.scores),
    ...(isWinner ? record.match?.score : {}),
  } as Record<string, unknown>;
  const nameScore = typeof merged.nameScore === 'number' ? merged.nameScore : 0;
  const addressScore = typeof merged.addressScore === 'number' ? merged.addressScore : null;
  const phoneScore = typeof merged.phoneScore === 'number' ? merged.phoneScore : null;
  const stateMatch = typeof merged.stateMatch === 'boolean' ? merged.stateMatch : true;
  const rawFullNameSimilarity = latestMemoValue(candidate.camsNormalized, 'fullNameSimilarity');
  const fullNameSimilarity = typeof rawFullNameSimilarity === 'number' ? rawFullNameSimilarity : 0;
  const rawTokenNameMatchRate = latestMemoValue(candidate.camsNormalized, 'tokenNameMatchRate');
  const tokenNameMatchRate = typeof rawTokenNameMatchRate === 'number' ? rawTokenNameMatchRate : 0;
  return {
    introductionStage: introductionStageOf(candidate.scores),
    nameScore,
    addressScore,
    phoneScore,
    stateMatch,
    fullNameSimilarity,
    tokenNameMatchRate,
    acmsAddress: acmsAddressString(record.acmsRaw),
    acmsPhone: record.acmsRaw.legacy?.phone ?? '',
    camsAddress: camsAddressString(candidate.camsRaw),
    camsPhone: candidate.camsRaw.phone?.number ?? '',
  };
}

/** Streams shard results one record's rows at a time. Opens in append mode so a resumed run adds
 * to an existing partial shard file instead of truncating already-reviewed records. */
class ShardReportWriter {
  private readonly stream: fs.WriteStream;

  constructor(outputPath: string, isResuming: boolean) {
    const isNewFile = !isResuming;
    this.stream = fs.createWriteStream(outputPath, { encoding: 'utf-8', flags: 'a' });
    if (isNewFile) {
      this.stream.write(csvRowLine(OUTPUT_HEADER));
    }
  }

  writeRecord(record: ReviewRecord, verdictsByTrusteeId: Map<string, VerdictResult>): void {
    for (const candidate of record.candidates) {
      const fields = deriveCandidateFields(record, candidate);
      const verdict = verdictsByTrusteeId.get(candidate.camsRaw.trusteeId);
      this.stream.write(
        csvRowLine([
          record.acmsProfessionalId,
          fields.introductionStage,
          record.acmsRaw.fullName,
          candidate.camsRaw.name,
          fields.stateMatch,
          fields.nameScore,
          fields.fullNameSimilarity,
          fields.tokenNameMatchRate,
          fields.acmsAddress,
          fields.camsAddress,
          fields.addressScore,
          fields.acmsPhone,
          fields.camsPhone,
          fields.phoneScore,
          candidate.camsRaw.trusteeId,
          verdict?.verdict ?? '',
          verdict?.reason ?? '',
        ]),
      );
    }
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }
}

function formatAcmsRecord(record: ReviewRecord): string {
  return [
    `Full name: ${record.acmsRaw.fullName || '(blank)'}`,
    `Address: ${acmsAddressString(record.acmsRaw) || '(blank)'}`,
    `Phone: ${record.acmsRaw.legacy?.phone || '(blank)'}`,
  ].join('\n');
}

function formatCandidate(
  record: ReviewRecord,
  candidate: ReviewRecord['candidates'][number],
  index: number,
): string {
  const fields = deriveCandidateFields(record, candidate);
  return [
    `### Candidate ${index + 1}`,
    `camsTrusteeId: ${candidate.camsRaw.trusteeId}`,
    `Name: ${candidate.camsRaw.name || '(blank)'}`,
    `Address: ${fields.camsAddress || '(blank)'}`,
    `Phone: ${fields.camsPhone || '(blank)'}`,
    `Structured signals: nameScore=${fields.nameScore}, fullNameSimilarity=${fields.fullNameSimilarity}, ` +
      `tokenNameMatchRate=${fields.tokenNameMatchRate}, stateMatch=${fields.stateMatch}, ` +
      `addressScore=${fields.addressScore}, phoneScore=${fields.phoneScore}`,
    `introductionStage: ${fields.introductionStage}`,
  ].join('\n');
}

function buildPrompt(template: string, record: ReviewRecord): string {
  const acmsRecord = formatAcmsRecord(record);
  const candidates = record.candidates
    .map((candidate, i) => formatCandidate(record, candidate, i))
    .join('\n\n');
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
    typeof result === 'string'
      ? (JSON.parse(result) as VerdictResponse)
      : (result as VerdictResponse);
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
  const { shard, of, unresolvedOnly } = parseCliArgs(process.argv.slice(2));

  const inputJsonlPath =
    process.env.REPLAY_BACKTEST_REPORT_JSONL ?? path.join(DATA_DIR, 'replay-backtest-report.jsonl');
  if (!fs.existsSync(inputJsonlPath)) {
    throw new Error(
      `${inputJsonlPath} does not exist. Run pipeline-replay-backtest.ts first, or set ` +
        'REPLAY_BACKTEST_REPORT_JSONL to point at an existing report.',
    );
  }

  const promptTemplate = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');

  const allRecords = readReviewRecords(inputJsonlPath);
  // Unresolved-only is the default: pattern-hunting only needs the records the pipeline DIDN'T
  // already auto-resolve (record.match === null) - screening the already-resolved population too
  // is a separate, more expensive false-positive sweep (see --unresolved-only=false), deliberately
  // NOT run by default since it re-confirms answers already trusted rather than surfacing new gaps.
  const candidateRecords = unresolvedOnly ? allRecords.filter((r) => r.match === null) : allRecords;
  const recordsById = new Map(candidateRecords.map((r) => [r.acmsProfessionalId, r]));
  const allIds = [...recordsById.keys()];
  const shardIds = partitionIds(allIds, shard, of);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const shardLabel = unresolvedOnly
    ? `unresolved-shard-${shard}-of-${of}`
    : `full-shard-${shard}-of-${of}`;
  const outputPath = path.join(DATA_DIR, `ai-review-${shardLabel}.csv`);
  const alreadyDone = alreadyReviewedIds(outputPath);
  const remainingIds = shardIds.filter((id) => !alreadyDone.has(id));

  console.log(
    `${shardLabel} (unresolvedOnly=${unresolvedOnly}): ${shardIds.length} records assigned, ` +
      `${alreadyDone.size} already reviewed (resuming), ${remainingIds.length} remaining\n`,
  );

  const writer = new ShardReportWriter(outputPath, alreadyDone.size > 0);

  let completed = 0;
  let matchCount = 0;
  let noMatchCount = 0;
  const erroredIds: string[] = [];

  await runWithConcurrency(remainingIds, CONCURRENCY, async (acmsProfessionalId) => {
    const record = recordsById.get(acmsProfessionalId)!;
    try {
      const prompt = buildPrompt(promptTemplate, record);
      const stdout = await runClaudeReview(prompt);
      const verdicts = extractVerdicts(stdout);
      const verdictsByTrusteeId = new Map(verdicts.map((v) => [v.camsTrusteeId, v]));
      // A response covering fewer candidates than the record actually has (the model truncated,
      // skipped some, or otherwise gave a partial answer) must be treated as a full failure, not
      // partially written - writing blanks for the uncovered rows would silently and permanently
      // lose those candidates, since a record only ever gets retried on resume when it's NOT
      // already present in the output file at all.
      const missingIds = record.candidates
        .map((c) => c.camsRaw.trusteeId)
        .filter((id) => !verdictsByTrusteeId.has(id));
      if (missingIds.length > 0) {
        throw new Error(
          `claude -p response covered ${verdicts.length}/${record.candidates.length} candidates, ` +
            `missing ${missingIds.length}: ${missingIds.slice(0, 5).join(', ')}${missingIds.length > 5 ? '...' : ''}`,
        );
      }
      writer.writeRecord(record, verdictsByTrusteeId);
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
        console.log(`${shardLabel}: ${completed}/${remainingIds.length} records reviewed`);
      }
    }
  });

  await writer.close();

  console.log(`\n=== ${shardLabel} summary ===`);
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
