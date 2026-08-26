/**
 * Exploratory audit: do the persisted TRUSTEE_PROFESSIONAL_ID records from a real sync-acms-
 * professional-ids run look right against the CAMS trustees export?
 *
 * Investigation only — makes NO changes to any collection or to the as-built matching logic.
 * Each TRUSTEE_PROFESSIONAL_ID document (../fixtures/<export>.json, a raw export of the
 * trustee-professional-ids collection) either carries a real camsTrusteeId (auto-linked) or an
 * `error` object (no-match/ambiguous/conflict, with camsTrusteeId set to the ACMS variant's
 * fingerprint instead of a real trustee — see TrusteeProfessionalIdError in
 * common/src/cams/trustee-professional-ids.ts). This harness decodes every record's `variant`
 * (same JSON shape buildAcmsVariant/buildVariant produce — see
 * backend/lib/use-cases/dataflows/acms-trustee-variant.helpers.ts) and scores it against CAMS
 * trustees using the SAME scoring functions production matching uses (calculateNameScore,
 * calculateAddressScore, calculatePhoneScore, calculateEmailScore from
 * trustee-match.helpers.ts) — not a new, separately-tuned comparison. Two passes:
 *
 *   1. Linked records: score the variant against the trustee it was actually linked to, to
 *      surface a past auto-link that looks like a poor match (false positive) — same approach as
 *      trustee-variation-audit, applied to the professional-id fast path instead of the
 *      trustee-variation fast path.
 *   2. Error records (no-match/ambiguous): score the variant against EVERY trustee in the export
 *      and report the best-scoring candidate, to surface a real match production's matcher
 *      missed (false negative) — this pass has no live-repository equivalent to call directly
 *      (matchTrusteeByName requires a database-backed ApplicationContext), so it re-implements
 *      the same name-then-corroborate logic as a plain in-memory scan instead.
 *
 * This is a one-shot script - NOT a Vitest test. No database is used; both fixture files are read
 * directly and compared in memory.
 *
 * Usage (from test/integration/):
 *   npm run sync-acms-professional-ids-audit
 *
 * Required fixtures (place in fixtures/ — gitignored, real trustee PII, never committed):
 *   <export>.json     Raw export of the trustee-professional-ids collection (TRUSTEE_PROFESSIONAL_ID docs)
 *     Pass the filename via PROFESSIONAL_IDS_FIXTURE, or the script defaults to the newest
 *     *trustee-professional-ids*.json file found in fixtures/.
 *   <export>.json     Raw export of the trustees collection ({"documentType":"TRUSTEE"} docs)
 *     Pass the filename via TRUSTEES_FIXTURE, or the script defaults to the newest
 *     *trustees*.json file found in fixtures/.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  calculateNameScore,
  calculateAddressScore,
  calculatePhoneScore,
  calculateEmailScore,
  parseCityStateZip,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

// A best-candidate score below this is not worth reporting for a no-match/ambiguous record — it
// just means nothing in the trustees export looks remotely like this variant, which is the
// expected (uninteresting) case for most genuine no-matches.
const NOTABLE_MISS_THRESHOLD = 60;

// Mirrors trustee-variation-audit's NAME_MISMATCH_THRESHOLD rationale: a linked record's own
// nameScore below this is worth a human glance, even though production trusted the fast path.
const NAME_MISMATCH_THRESHOLD = 85;

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

type MongoExtendedId = { $oid?: string } | string | undefined;

type DecodedVariant = {
  firstName: string;
  middleName: string;
  lastName: string;
  generation: string;
  address1: string;
  address2: string;
  address3: string;
  cityStateZipCountry: string;
  phone: string;
  fax: string;
  email: string;
};

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
    .sort(); // filenames are date-prefixed (YYYY-MM-DD-...), so lexical sort is chronological
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

function loadTrustees(): Trustee[] {
  const file = resolveFixtureFile('TRUSTEES_FIXTURE', 'trustees');
  const raw: (Trustee & { _id?: MongoExtendedId })[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`Trustees fixture: ${path.basename(file)}\n`);
  return raw.map((doc) => stripMongoId(doc) as Trustee);
}

/**
 * Decodes a variant's JSON string (see buildAcmsVariant/buildVariant) and reshapes it into a
 * DxtrTrusteeParty so this harness can call the exact same scoring functions production matching
 * uses, unmodified.
 */
function toAcmsTrusteeParty(variant: DecodedVariant): DxtrTrusteeParty {
  const fullName = [variant.firstName, variant.middleName, variant.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    fullName,
    firstName: variant.firstName || undefined,
    middleName: variant.middleName || undefined,
    lastName: variant.lastName || undefined,
    generation: variant.generation || undefined,
    legacy: {
      address1: variant.address1 || undefined,
      address2: variant.address2 || undefined,
      address3: variant.address3 || undefined,
      cityStateZipCountry: variant.cityStateZipCountry || undefined,
      phone: variant.phone || undefined,
      fax: variant.fax || undefined,
      email: variant.email || undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type ScoredAgainst = {
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
  emailScore: number | null;
};

function scoreAgainst(acmsTrustee: DxtrTrusteeParty, trustee: Trustee): ScoredAgainst {
  return {
    nameScore: calculateNameScore(acmsTrustee, trustee),
    addressScore: calculateAddressScore(acmsTrustee.legacy, trustee.public.address),
    phoneScore: calculatePhoneScore(acmsTrustee.legacy?.phone, trustee.public.phone),
    emailScore: calculateEmailScore(acmsTrustee.legacy?.email, trustee.public.email),
  };
}

type LinkedAuditResult = {
  recordId: string;
  acmsProfessionalId: string;
  camsTrusteeId: string;
  trusteeFound: boolean;
  acmsFullName: string;
  camsName?: string;
  scores?: ScoredAgainst;
  concern: 'trustee-not-found' | 'name-mismatch' | 'weak-corroboration' | 'none';
};

function classifyLinkedConcern(
  nameScore: number,
  addressScore: number,
): LinkedAuditResult['concern'] {
  if (nameScore < NAME_MISMATCH_THRESHOLD) return 'name-mismatch';
  if (addressScore === 0) return 'weak-corroboration';
  return 'none';
}

function auditLinkedRecord(
  record: TrusteeProfessionalId,
  trusteesById: Map<string, Trustee>,
): LinkedAuditResult {
  const decoded: DecodedVariant | null = record.variant ? JSON.parse(record.variant) : null;
  const acmsTrustee = decoded ? toAcmsTrusteeParty(decoded) : { fullName: '(no variant)' };
  const trustee = trusteesById.get(record.camsTrusteeId);

  if (!trustee) {
    return {
      recordId: record.id,
      acmsProfessionalId: record.acmsProfessionalId,
      camsTrusteeId: record.camsTrusteeId,
      trusteeFound: false,
      acmsFullName: acmsTrustee.fullName,
      concern: 'trustee-not-found',
    };
  }

  const scores = decoded ? scoreAgainst(acmsTrustee, trustee) : undefined;

  return {
    recordId: record.id,
    acmsProfessionalId: record.acmsProfessionalId,
    camsTrusteeId: record.camsTrusteeId,
    trusteeFound: true,
    acmsFullName: acmsTrustee.fullName,
    camsName: trustee.name,
    scores,
    concern: scores ? classifyLinkedConcern(scores.nameScore, scores.addressScore) : 'none',
  };
}

type MissedMatchResult = {
  recordId: string;
  acmsProfessionalId: string;
  disposition: string;
  acmsFullName: string;
  zipParseable: boolean;
  bestCandidate?: { trusteeId: string; trusteeName: string; scores: ScoredAgainst };
};

function findBestCandidate(
  acmsTrustee: DxtrTrusteeParty,
  trustees: Trustee[],
): { trusteeId: string; trusteeName: string; scores: ScoredAgainst } | null {
  let best: { trustee: Trustee; scores: ScoredAgainst } | null = null;

  for (const trustee of trustees) {
    const scores = scoreAgainst(acmsTrustee, trustee);
    // A blunt, single-pass "does this look like the same person" signal for this exploratory
    // scan — not calculateCandidateScore's full weighted blend, since that also needs
    // district/chapter (appointment context this fixture-only harness never has). Name is the
    // primary signal; address as a tiebreaker among equally-named candidates.
    if (
      !best ||
      scores.nameScore > best.scores.nameScore ||
      (scores.nameScore === best.scores.nameScore && scores.addressScore > best.scores.addressScore)
    ) {
      best = { trustee, scores };
    }
  }

  if (!best) return null;
  return { trusteeId: best.trustee.trusteeId, trusteeName: best.trustee.name, scores: best.scores };
}

function auditErrorRecord(
  record: TrusteeProfessionalId,
  trustees: Trustee[],
): MissedMatchResult | null {
  if (!record.variant) return null;
  const decoded: DecodedVariant = JSON.parse(record.variant);
  const acmsTrustee = toAcmsTrusteeParty(decoded);
  const best = findBestCandidate(acmsTrustee, trustees);

  return {
    recordId: record.id,
    acmsProfessionalId: record.acmsProfessionalId,
    disposition: record.error?.disposition ?? 'unknown',
    acmsFullName: acmsTrustee.fullName,
    // calculateAddressScore returns 0 outright when this fails to parse (see
    // parseCityStateZip's doc comment) — a record with an unparseable zip had NO address
    // corroboration available at all, regardless of how well the raw address text might
    // otherwise line up. Surfaced separately so a "notable miss" isn't misread as evidence the
    // matcher ignored good address data; it may mean address data was structurally unusable.
    zipParseable: parseCityStateZip(decoded.cityStateZipCountry) !== null,
    bestCandidate: best ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function run() {
  console.log('\nAuditing TRUSTEE_PROFESSIONAL_ID records against the CAMS trustees export...\n');

  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const trusteesById = new Map(trustees.map((t) => [t.trusteeId, t]));

  const linked = records.filter((r) => !r.error);
  const errored = records.filter((r) => r.error);

  console.log(
    `Loaded ${records.length} professional-id records (${linked.length} linked, ` +
      `${errored.length} errored), ${trustees.length} trustees.\n`,
  );

  // --- Pass 1: linked records -------------------------------------------------
  const linkedResults = linked.map((r) => auditLinkedRecord(r, trusteesById));
  const linkedCounts = {
    none: 0,
    'name-mismatch': 0,
    'weak-corroboration': 0,
    'trustee-not-found': 0,
  };
  for (const r of linkedResults) linkedCounts[r.concern]++;

  console.log('=== Pass 1: linked records (checking for false positives) ===\n');
  console.log('Outcome summary:');
  for (const [concern, count] of Object.entries(linkedCounts)) {
    console.log(`  ${concern.padEnd(20)} ${count}`);
  }

  console.log(
    '\nDetail — trustee-not-found (linked to a camsTrusteeId absent from the trustees export):',
  );
  for (const r of linkedResults.filter((r) => r.concern === 'trustee-not-found')) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) -> missing trusteeId ${r.camsTrusteeId}`,
    );
  }

  console.log(
    `\nDetail — name-mismatch (nameScore < ${NAME_MISMATCH_THRESHOLD} on a record production auto-linked):`,
  );
  for (const r of linkedResults.filter((r) => r.concern === 'name-mismatch')) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) -> "${r.camsName}" (${r.camsTrusteeId}) ` +
        `[name=${r.scores?.nameScore} address=${r.scores?.addressScore} phone=${r.scores?.phoneScore} email=${r.scores?.emailScore}]`,
    );
  }

  console.log(
    '\nDetail — weak-corroboration (name matched, address could not corroborate at all):',
  );
  for (const r of linkedResults.filter((r) => r.concern === 'weak-corroboration')) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) -> "${r.camsName}" (${r.camsTrusteeId}) ` +
        `[name=${r.scores?.nameScore} address=${r.scores?.addressScore} phone=${r.scores?.phoneScore} email=${r.scores?.emailScore}]`,
    );
  }

  // --- Pass 2: error records ---------------------------------------------------
  const errorResults = errored
    .map((r) => auditErrorRecord(r, trustees))
    .filter((r): r is MissedMatchResult => r !== null);

  const byDisposition: Record<string, number> = {};
  for (const r of errorResults)
    byDisposition[r.disposition] = (byDisposition[r.disposition] ?? 0) + 1;

  const notableMisses = errorResults.filter(
    (r) => r.bestCandidate && r.bestCandidate.scores.nameScore >= NOTABLE_MISS_THRESHOLD,
  );

  const unparseableZipCount = errorResults.filter((r) => !r.zipParseable).length;

  console.log('\n=== Pass 2: error records (checking for false negatives) ===\n');
  console.log('Disposition summary:');
  for (const [disposition, count] of Object.entries(byDisposition)) {
    console.log(`  ${disposition.padEnd(20)} ${count}`);
  }

  console.log(
    `\nUnparseable zip (parseCityStateZip returned null -> addressScore forced to 0, no address ` +
      `corroboration possible): ${unparseableZipCount} of ${errorResults.length} error records ` +
      `(${((unparseableZipCount / errorResults.length) * 100).toFixed(1)}%)`,
  );

  console.log(
    `\nNotable misses (best candidate's nameScore >= ${NOTABLE_MISS_THRESHOLD} on a record production ` +
      `did NOT link — worth a human glance to see if the matcher should have caught this):`,
  );
  for (const r of notableMisses) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) [${r.disposition}]` +
        `${r.zipParseable ? '' : ' [unparseable zip]'} -> best candidate ` +
        `"${r.bestCandidate!.trusteeName}" (${r.bestCandidate!.trusteeId}) ` +
        `[name=${r.bestCandidate!.scores.nameScore} address=${r.bestCandidate!.scores.addressScore} ` +
        `phone=${r.bestCandidate!.scores.phoneScore} email=${r.bestCandidate!.scores.emailScore}]`,
    );
  }
  console.log(
    `\n  (${notableMisses.length} of ${errorResults.length} error records are notable misses)`,
  );

  console.log(
    `\nReplayed ${records.length} professional-id records ` +
      `(${linkedResults.length} linked, ${errorResults.length} errored).\n`,
  );
}

run();
