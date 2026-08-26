/**
 * Backtest: how does the CAMS-880 WEIGHTS/threshold/gap rebalance in
 * calculateTotalScore change trustee-match outcomes against real, already-encountered mismatches?
 *
 * Investigation only — makes NO changes to any collection or to the as-built matching logic. Each
 * TRUSTEE_MATCH_VERIFICATION document (a real staging export, see fixtures/ below) carries a
 * matchCandidates array — the exact CandidateScore objects production computed at the time
 * (addressScore, nameScore, phoneScore, emailScore, districtDivisionScore, chapterScore,
 * totalScore), frozen at write time. This harness re-derives each candidate's totalScore under
 * the CURRENT weights (imported from trustee-match.helpers.ts, so it can never drift from
 * production) and under the OLD weights (hardcoded below, since the old constants no longer exist
 * in source — this is their only remaining record), then compares the resulting resolution
 * outcome (resolved/unresolved/ambiguous, and which trustee wins) old vs. new.
 *
 * districtDivisionScore/chapterScore are used as a direct proxy for isAppointmentMatch's boolean
 * (court+division+chapter all covered by a SINGLE appointment): calculateDistrictDivisionScore
 * and calculateChapterScore are both binary-or-scoped (100 only when an active appointment covers
 * the case's court+division; chapterScore is itself scoped to that same division-matching
 * appointment set), so districtDivisionScore===100 && chapterScore===100 on a candidate reliably
 * means an appointment on that candidate satisfied isAppointmentMatch when the doc was written.
 * The case's own courtDivisionCode/chapter aren't persisted on the verification document, so this
 * proxy is used instead of recomputing isAppointmentMatch from scratch.
 *
 * This is a one-shot script - NOT a Vitest test. No database is used; fixture files are read
 * directly and compared in memory.
 *
 * Usage (from test/integration/):
 *   npm run trustee-match-weight-backtest
 *
 * Required fixtures (place in fixtures/ — gitignored, real trustee PII, never committed):
 *   <verification export(s)>.json  Raw export(s) of the trustee-match-verification collection
 *     Pass one or more filenames via VERIFICATION_FIXTURES (comma-separated), or the script
 *     defaults to every *trustee-verification*.json file found in fixtures/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { calculateTotalScore } from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { CandidateScore } from '../../../../common/src/cams/dataflow-events';
import { TrusteeMatchVerification } from '../../../../common/src/cams/trustee-match-verification';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

// The retired constants this rebalance replaced (CAMS-880) — kept here only as the historical
// baseline for this backtest; they no longer exist anywhere in source.
const OLD_WEIGHTS = {
  addressScore: 0.05,
  nameScore: 0.25,
  phoneScore: 0.05,
  emailScore: 0.05,
  districtDivisionScore: 0.3,
  chapterScore: 0.3,
} as const;
const OLD_THRESHOLD = 75;
const OLD_MIN_GAP = 5;

const NEW_THRESHOLD = 74;
const NEW_MIN_GAP = 8;

function calculateOldTotalScore(scores: {
  addressScore: number;
  nameScore: number;
  phoneScore: number | null;
  emailScore: number | null;
  districtDivisionScore: number;
  chapterScore: number;
}): number {
  let weightedSum = 0;
  let applicableWeight = 0;
  for (const key of Object.keys(OLD_WEIGHTS) as (keyof typeof OLD_WEIGHTS)[]) {
    const score = scores[key];
    if (score === null) continue;
    weightedSum += score * OLD_WEIGHTS[key];
    applicableWeight += OLD_WEIGHTS[key];
  }
  return applicableWeight === 0 ? 0 : weightedSum / applicableWeight;
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

type MongoExtendedId = { $oid?: string } | string | undefined;

function stripMongoId<T extends { _id?: MongoExtendedId }>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

function resolveFixtureFiles(): string[] {
  const explicit = process.env.VERIFICATION_FIXTURES;
  if (explicit) {
    return explicit.split(',').map((f) => path.join(FIXTURES_DIR, f.trim()));
  }
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.includes('trustee-verification') && f.endsWith('.json'))
    .map((f) => path.join(FIXTURES_DIR, f));
}

function loadVerifications(): TrusteeMatchVerification[] {
  const files = resolveFixtureFiles();
  const seenIds = new Set<string>();
  const docs: TrusteeMatchVerification[] = [];
  for (const file of files) {
    const raw: (TrusteeMatchVerification & { _id?: MongoExtendedId })[] = JSON.parse(
      fs.readFileSync(file, 'utf-8'),
    );
    for (const doc of raw) {
      const clean = stripMongoId(doc) as TrusteeMatchVerification;
      // Same fingerprint/id can appear in more than one export snapshot; keep the first
      // occurrence only so overlapping exports don't double-count a record.
      if (seenIds.has(clean.id)) continue;
      seenIds.add(clean.id);
      docs.push(clean);
    }
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Re-scoring and outcome derivation
// ---------------------------------------------------------------------------

type RescoredCandidate = CandidateScore & {
  oldTotalScore: number;
  newTotalScore: number;
  sameAppointmentMatch: boolean;
};

type Outcome = { kind: 'resolved'; trusteeId: string } | { kind: 'unresolved' | 'no-candidates' };

function rescoreCandidate(candidate: CandidateScore): RescoredCandidate {
  const base = {
    addressScore: candidate.addressScore,
    nameScore: candidate.nameScore,
    phoneScore: candidate.phoneScore,
    emailScore: candidate.emailScore,
    districtDivisionScore: candidate.districtDivisionScore,
    chapterScore: candidate.chapterScore,
  };
  return {
    ...candidate,
    oldTotalScore: calculateOldTotalScore(base),
    newTotalScore: calculateTotalScore(base),
    // See file header: districtDivisionScore/chapterScore both at 100 is used as a direct proxy
    // for isAppointmentMatch, since the case's own courtDivisionCode/chapter aren't persisted here.
    sameAppointmentMatch: candidate.districtDivisionScore === 100 && candidate.chapterScore === 100,
  };
}

function deriveOutcome(
  candidates: RescoredCandidate[],
  totalScoreKey: 'oldTotalScore' | 'newTotalScore',
  threshold: number,
  minGap: number,
): Outcome {
  if (candidates.length === 0) return { kind: 'no-candidates' };

  const sorted = [...candidates].sort((a, b) => b[totalScoreKey] - a[totalScoreKey]);
  const winner = sorted[0];
  const runnerUp = sorted[1];

  const meetsThreshold = winner[totalScoreKey] > threshold;
  const hasSignificantGap = !runnerUp || winner[totalScoreKey] - runnerUp[totalScoreKey] >= minGap;

  if (meetsThreshold && hasSignificantGap && winner.sameAppointmentMatch) {
    return { kind: 'resolved', trusteeId: winner.trusteeId };
  }
  return { kind: 'unresolved' };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

type ComparisonRow = {
  verificationId: string;
  dxtrFullName: string;
  mismatchReason?: string;
  oldOutcome: Outcome;
  newOutcome: Outcome;
  changed: boolean;
  candidates: RescoredCandidate[];
};

function compareVerification(doc: TrusteeMatchVerification): ComparisonRow | null {
  if (!doc.matchCandidates || doc.matchCandidates.length === 0) return null;

  const rescored = doc.matchCandidates.map(rescoreCandidate);
  const oldOutcome = deriveOutcome(rescored, 'oldTotalScore', OLD_THRESHOLD, OLD_MIN_GAP);
  const newOutcome = deriveOutcome(rescored, 'newTotalScore', NEW_THRESHOLD, NEW_MIN_GAP);

  const changed =
    oldOutcome.kind !== newOutcome.kind ||
    (oldOutcome.kind === 'resolved' &&
      newOutcome.kind === 'resolved' &&
      oldOutcome.trusteeId !== newOutcome.trusteeId);

  return {
    verificationId: doc.id,
    dxtrFullName: doc.dxtrTrustee.fullName,
    mismatchReason: doc.mismatchReason,
    oldOutcome,
    newOutcome,
    changed,
    candidates: rescored,
  };
}

function describeOutcome(o: Outcome): string {
  if (o.kind === 'resolved') return `resolved -> ${o.trusteeId}`;
  if (o.kind === 'no-candidates') return 'no-candidates';
  return 'unresolved';
}

function run() {
  console.log('\nBacktesting CAMS-880 weight/threshold/gap rebalance against real verification records...\n');

  const verifications = loadVerifications();
  const withCandidates = verifications.filter((d) => d.matchCandidates?.length > 0);

  console.log(
    `Loaded ${verifications.length} verification records (${withCandidates.length} with scored candidates).\n`,
  );

  const rows = withCandidates.map(compareVerification).filter((r): r is ComparisonRow => r !== null);

  const changedRows = rows.filter((r) => r.changed);

  console.log(`Old weights: ${JSON.stringify(OLD_WEIGHTS)}, threshold=${OLD_THRESHOLD}, gap=${OLD_MIN_GAP}`);
  console.log(`New weights: current trustee-match.helpers.ts, threshold=${NEW_THRESHOLD}, gap=${NEW_MIN_GAP}\n`);

  console.log(`Records compared: ${rows.length}`);
  console.log(`Outcome changed:  ${changedRows.length}\n`);

  if (changedRows.length > 0) {
    console.log('Detail — records whose outcome changed:');
    for (const row of changedRows) {
      console.log(
        `  "${row.dxtrFullName}" [${row.mismatchReason ?? 'n/a'}] ` +
          `old=${describeOutcome(row.oldOutcome)} new=${describeOutcome(row.newOutcome)}`,
      );
      for (const c of row.candidates) {
        console.log(
          `      ${c.trusteeId} (${c.trusteeName}): oldTotal=${c.oldTotalScore.toFixed(2)} ` +
            `newTotal=${c.newTotalScore.toFixed(2)} ` +
            `[addr=${c.addressScore} name=${c.nameScore} phone=${c.phoneScore} email=${c.emailScore} ` +
            `district=${c.districtDivisionScore} chapter=${c.chapterScore} ` +
            `appointmentMatch=${c.sameAppointmentMatch}]`,
        );
      }
    }
    console.log();
  }

  console.log(`Replayed ${rows.length} verification records against both weight sets.\n`);
}

run();
