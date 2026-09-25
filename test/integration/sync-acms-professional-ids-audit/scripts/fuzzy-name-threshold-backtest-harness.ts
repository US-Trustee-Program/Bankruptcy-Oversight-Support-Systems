/**
 * Backtest: does isFuzzyNamePartMatch's SoundEx/Metaphone OR-branch (trustee-match-pipeline-
 * stages.ts) let through name-part pairs a real ambiguous-record population shows are DIFFERENT
 * people, and does raising the bar cost any GENUINE matches in exchange?
 *
 * Investigation only — makes NO changes to any collection or to the as-built matching logic.
 *
 * isFuzzyNamePartMatch treats a first/last name PART as plausibly-the-same-name when EITHER
 * JaroWinklerDistance >= FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD (0.88) OR a SoundEx match OR a
 * Metaphone match. The JaroWinkler bar has its own backtest-derived doc comment (0.88 excludes
 * "Van Doe"/"Van Roe" while still passing every genuine spelling-variant pair its author found).
 * SoundEx has no equivalent tuning record and is documented (this repo's own investigation) to
 * collide clearly-different first names sharing a coarse phonetic bucket (SoundEx("mark") ==
 * SoundEx("maurice") == "M620"; also true of John/Jane, Tim/Tom, Sam/Sean, Don/Dawn, Roy/Ray).
 *
 * Ground truth for this backtest comes from real candidate pools, not synthetic examples:
 *   POSITIVE — a candidate that IS state.match.trusteeId (production's own accepted resolution)
 *   NEGATIVE — a DIFFERENT candidate in the SAME record's pool that was NOT selected. A rejected
 *     candidate sharing a candidate pool with the winner is real evidence of a DIFFERENT person -
 *     production discovered them via the same name/geo signals and considered them, then a later
 *     stage (name/contact corroboration) set them apart from the winner.
 *
 * For each first/last name-PART pair in that population, this replays every policy variant
 * (current OR-of-three; SoundEx dropped; SoundEx required to also clear a lower secondary
 * JaroWinkler floor) and reports how many positives keep passing vs. how many negatives stop
 * passing - the tradeoff a plain "how many flagged records exist" count can't show.
 *
 * This is a one-shot script - NOT a Vitest test. No database is used; fixture files are read
 * directly and compared in memory.
 *
 * Usage (from test/integration/):
 *   npm run fuzzy-name-threshold-backtest
 *
 * Required fixtures (place in fixtures/ — gitignored, real trustee PII, never committed):
 *   <export>.json  Raw export of the trustee-professional-ids collection (TRUSTEE_PROFESSIONAL_ID
 *     docs, WITH their full evidence.candidates pool - this backtest needs rejected candidates,
 *     not just the accepted match).
 *     Pass the filename via PROFESSIONAL_IDS_FIXTURE, or the script defaults to the newest
 *     *trustee-professional-ids*.json file found in fixtures/.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as natural from 'natural';
import { TrusteeProfessionalId } from '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const JARO_WINKLER_THRESHOLD = 0.88;
// A candidate secondary floor for the "SoundEx must also clear a lower JaroWinkler bar" policy
// variant - low enough to still admit genuine spelling variants a bare SoundEx match catches
// (e.g. "gipson"/"gibson"), high enough to reject unrelated short names that only share a
// coarse phonetic bucket (e.g. "mark"/"maurice").
const SOUNDEX_SECONDARY_JW_FLOOR = 0.75;

type MongoExtendedId = { $oid?: string } | string | undefined;

function stripMongoId<T extends { _id?: MongoExtendedId }>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

function resolveFixtureFile(envVar: string, namePattern: string): string {
  const explicit = process.env[envVar];
  if (explicit) return path.join(FIXTURES_DIR, explicit);
  const matches = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.includes(namePattern) && f.endsWith('.json'))
    .sort();
  if (matches.length === 0) {
    throw new Error(`No fixture matching "*${namePattern}*.json" found in ${FIXTURES_DIR}`);
  }
  return path.join(FIXTURES_DIR, matches[matches.length - 1]);
}

function loadProfessionalIds(): TrusteeProfessionalId[] {
  const file = resolveFixtureFile('PROFESSIONAL_IDS_FIXTURE', 'trustee-professional-ids');
  const raw: (TrusteeProfessionalId & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  console.log(`Professional IDs fixture: ${path.basename(file)}`);
  return raw.map(stripMongoId);
}

// ---------------------------------------------------------------------------
// Ground-truth pair extraction
// ---------------------------------------------------------------------------

type LabeledPair = {
  acmsProfessionalId: string;
  field: 'firstName' | 'lastName';
  acmsValue: string;
  camsValue: string;
  label: 'positive' | 'negative';
  acmsFullName: string;
  camsName: string;
};

/**
 * A CAMS-side duplicate-record guard for the negative set: real "person A vs person B" negative
 * evidence requires the WINNER and the rejected candidate to be different people on the CAMS side
 * too, not merely different trusteeId values. CAMS holds genuine duplicate/near-duplicate trustee
 * records for one real person often enough (e.g. two "Duke C. Salisbury" records at different
 * office addresses) that "different trusteeId" alone is not a trustworthy negative label - a
 * rejected candidate whose OWN name is near-identical to the winner's is far more likely a CAMS
 * data-quality duplicate than a different real person, and including it as a negative would
 * blame the fuzzy-name gate for a problem that is actually duplicate CAMS records.
 */
function isLikelyDuplicateCamsRecord(winnerName: string, candidateName: string): boolean {
  if (winnerName === candidateName) return true;
  return natural.JaroWinklerDistance(winnerName, candidateName) >= 0.92;
}

function extractPairs(records: TrusteeProfessionalId[]): LabeledPair[] {
  const pairs: LabeledPair[] = [];

  for (const record of records) {
    const norm = record.evidence.sourceNormalized;
    const matchTrusteeId = record.evidence.match?.trusteeId;
    if (!norm || record.evidence.candidates.length < 2) continue; // need pool context for a negative
    if (!matchTrusteeId) continue;

    const winner = record.evidence.candidates.find(
      (c: (typeof record.evidence.candidates)[number]) => c.camsRaw.trusteeId === matchTrusteeId,
    );
    if (!winner) continue;
    const winnerNameLower = (winner.camsRaw.name ?? '').toLowerCase();

    for (const candidate of record.evidence.candidates) {
      const isWinner = candidate.camsRaw.trusteeId === matchTrusteeId;
      const candidateNameLower = (candidate.camsRaw.name ?? '').toLowerCase();
      // A non-winner is only a trustworthy NEGATIVE when it's a genuinely different person from
      // the winner, not a CAMS duplicate record for the same person (see
      // isLikelyDuplicateCamsRecord's own doc comment).
      if (!isWinner && isLikelyDuplicateCamsRecord(winnerNameLower, candidateNameLower)) continue;
      const label: 'positive' | 'negative' = isWinner ? 'positive' : 'negative';

      for (const field of ['firstName', 'lastName'] as const) {
        const acmsValue = norm[field];
        const camsValue = candidate.camsNormalized[field];
        if (!acmsValue || !camsValue) continue;
        if (acmsValue === camsValue) continue; // exact match - not a fuzzy-gate question at all
        pairs.push({
          acmsProfessionalId: record.acmsProfessionalId,
          field,
          acmsValue,
          camsValue,
          label,
          acmsFullName: record.evidence.sourceRaw.fullName,
          camsName: candidate.camsRaw.name,
        });
      }
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Policy variants
// ---------------------------------------------------------------------------

const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

function safeSoundexCompare(a: string, b: string): boolean {
  try {
    return soundex.compare(a, b);
  } catch {
    return false;
  }
}

function safeMetaphoneCompare(a: string, b: string): boolean {
  try {
    return metaphone.compare(a, b);
  } catch {
    return false;
  }
}

type Policy = { name: string; passes: (a: string, b: string, jw: number) => boolean };

const POLICIES: Policy[] = [
  {
    name: 'current (JW>=0.88 OR SoundEx OR Metaphone)',
    passes: (a, b, jw) => jw >= JARO_WINKLER_THRESHOLD || safeSoundexCompare(a, b) || safeMetaphoneCompare(a, b),
  },
  {
    name: 'drop SoundEx (JW>=0.88 OR Metaphone)',
    passes: (a, b, jw) => jw >= JARO_WINKLER_THRESHOLD || safeMetaphoneCompare(a, b),
  },
  {
    name: 'SoundEx requires JW>=0.75 too (JW>=0.88 OR (SoundEx AND JW>=0.75) OR Metaphone)',
    passes: (a, b, jw) =>
      jw >= JARO_WINKLER_THRESHOLD ||
      (safeSoundexCompare(a, b) && jw >= SOUNDEX_SECONDARY_JW_FLOOR) ||
      safeMetaphoneCompare(a, b),
  },
  {
    name: 'drop SoundEx AND Metaphone (JW>=0.88 only)',
    passes: (_a, _b, jw) => jw >= JARO_WINKLER_THRESHOLD,
  },
];

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function run() {
  console.log('\nBacktesting isFuzzyNamePartMatch policy variants against real candidate pools...\n');

  const records = loadProfessionalIds();
  const pairs = extractPairs(records);
  const positives = pairs.filter((p) => p.label === 'positive');
  const negatives = pairs.filter((p) => p.label === 'negative');

  console.log(
    `Extracted ${pairs.length} non-exact name-part pairs from multi-candidate pools ` +
      `(${positives.length} positive - production's accepted match, ${negatives.length} negative ` +
      `- a different trusteeId rejected from the same pool).\n`,
  );

  for (const policy of POLICIES) {
    let posPass = 0;
    let negPass = 0;
    const negPassDetails: LabeledPair[] = [];
    const posFailDetails: LabeledPair[] = [];

    for (const pair of pairs) {
      const jw = natural.JaroWinklerDistance(pair.acmsValue, pair.camsValue);
      const passes = policy.passes(pair.acmsValue, pair.camsValue, jw);
      if (pair.label === 'positive') {
        if (passes) posPass++;
        else posFailDetails.push(pair);
      } else {
        if (passes) {
          negPass++;
          negPassDetails.push(pair);
        }
      }
    }

    console.log(`=== Policy: ${policy.name} ===`);
    console.log(
      `  Positives passing: ${posPass}/${positives.length} ` +
        `(${((posPass / positives.length) * 100).toFixed(1)}%) - genuine matches this policy still admits`,
    );
    console.log(
      `  Negatives passing: ${negPass}/${negatives.length} ` +
        `(${((negPass / negatives.length) * 100).toFixed(1)}%) - DIFFERENT people this policy would ` +
        `still let through the fuzzy gate (false-positive risk surface)`,
    );
    if (negPassDetails.length > 0) {
      console.log('  Negative pairs still passing (different people, same candidate pool):');
      for (const d of negPassDetails) {
        console.log(
          `    ${d.acmsProfessionalId} [${d.field}] "${d.acmsValue}" vs "${d.camsValue}" ` +
            `("${d.acmsFullName}" pool includes non-winner "${d.camsName}")`,
        );
      }
    }
    if (posFailDetails.length > 0) {
      console.log('  Positive pairs NO LONGER passing (genuine matches this policy would lose):');
      for (const d of posFailDetails) {
        console.log(
          `    ${d.acmsProfessionalId} [${d.field}] "${d.acmsValue}" vs "${d.camsValue}" ` +
            `("${d.acmsFullName}" -> "${d.camsName}")`,
        );
      }
    }
    console.log();
  }
}

run();
