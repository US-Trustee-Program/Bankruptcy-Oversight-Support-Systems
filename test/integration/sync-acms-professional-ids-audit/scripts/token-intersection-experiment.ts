/**
 * Experiment (NOT a harness, not committed for reuse - see notes at end of run() for cleanup):
 * for every 'no-name-candidate' ACMS professional-id error record (nothing clears nameScore>=85
 * against the trustees export), tokenize the ACMS fullName and, PER TOKEN, find every trustee
 * whose own name contains that token. Intersect the per-token trustee-id sets - a trustee
 * appearing in EVERY token's result set is a much stronger candidate than one found by any
 * single token alone, which is what today's matchTrusteeByName tiers effectively do (full-name
 * equality, or a single first-lastName-token search). This does NOT reproduce
 * searchTrusteesByNameScored's real phonetic-token index (that requires a live Mongo instance) -
 * it's a plain-substring proxy against the fixture data, good enough to size whether the
 * intersection IDEA has legs before building it against the real repository/query.
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/token-intersection-experiment.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { calculateNameScore } from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const NAME_THRESHOLD = 85;

// Tokens shorter than this are dropped before intersecting - a single-letter initial ("A", "M")
// would match almost every trustee and defeat the point of intersection as a narrowing signal.
const MIN_TOKEN_LENGTH = 3;

// Common suffixes/role markers that shouldn't count as a discriminating name token.
const STOPWORDS = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'tr', 'trustee', 'inc', 'esq', 'not', 'use', 'do',
]);

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

function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

function loadProfessionalIds(): TrusteeProfessionalId[] {
  const file = path.join(FIXTURES_DIR, '2026-08-26-trustee-professional-ids.json');
  const raw: (TrusteeProfessionalId & { _id?: unknown })[] = JSON.parse(
    fs.readFileSync(file, 'utf-8'),
  );
  return raw.map(stripMongoId);
}

function loadTrustees(): Trustee[] {
  const file = path.join(FIXTURES_DIR, '2026-08-18-trustees.json');
  const raw: (Trustee & { _id?: unknown })[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return raw.map((doc) => stripMongoId(doc) as Trustee);
}

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

function tokenize(fullName: string): string[] {
  const raw = fullName
    .toLowerCase()
    .replace(/[.,()/*]/g, ' ')
    .replace(/[-']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(raw)].filter(
    (t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t),
  );
}

function trusteeSearchableText(trustee: Trustee): string {
  return trustee.name.toLowerCase();
}

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);

  // Pre-verify: confirm these are genuinely 'no-name-candidate' under the existing rule
  // (nameScore never clears 85 against anything) before trying the token-intersection idea on
  // them - otherwise we'd be re-discovering records the existing rule already catches.
  const noNameCandidateRecords: { record: TrusteeProfessionalId; acmsTrustee: DxtrTrusteeParty }[] =
    [];
  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrustee = toAcmsTrusteeParty(decoded);
    let qualifies = false;
    for (const trustee of trustees) {
      if (calculateNameScore(acmsTrustee, trustee) >= NAME_THRESHOLD) {
        qualifies = true;
        break;
      }
    }
    if (!qualifies) noNameCandidateRecords.push({ record, acmsTrustee });
  }

  console.log(`no-name-candidate population: ${noNameCandidateRecords.length}\n`);

  // Exclude the known "NO TRUSTEE"-style placeholders - they were never going
  // to match anything, and would just add noise to this experiment's counts.
  const placeholderPattern = /\bno trustee\b/i;
  const real = noNameCandidateRecords.filter(
    ({ acmsTrustee }) => !placeholderPattern.test(acmsTrustee.fullName),
  );
  console.log(`  minus "NO TRUSTEE"-pattern placeholders: ${real.length} remain\n`);

  type IntersectionResult = {
    acmsFullName: string;
    acmsProfessionalId: string;
    tokens: string[];
    intersection: Trustee[];
  };

  const results: IntersectionResult[] = [];

  for (const { record, acmsTrustee } of real) {
    const tokens = tokenize(acmsTrustee.fullName);
    if (tokens.length < 2) {
      // Need at least 2 tokens for an intersection to mean anything - a single-token ACMS name
      // (e.g. a company name with no discernible person-name shape) can't be narrowed this way.
      continue;
    }

    let candidateSet: Set<string> | null = null;
    const trusteeById = new Map(trustees.map((t) => [t.trusteeId, t]));

    for (const token of tokens) {
      const matchingIds = new Set(
        trustees
          .filter((t) => trusteeSearchableText(t).includes(token))
          .map((t) => t.trusteeId),
      );
      candidateSet = candidateSet === null ? matchingIds : intersect(candidateSet, matchingIds);
      if (candidateSet.size === 0) break; // no point continuing once intersection is empty
    }

    const intersection = [...(candidateSet ?? [])].map((id) => trusteeById.get(id)!).filter(Boolean);
    results.push({
      acmsFullName: acmsTrustee.fullName,
      acmsProfessionalId: record.acmsProfessionalId,
      tokens,
      intersection,
    });
  }

  console.log(`Records with >=2 usable tokens, intersection attempted: ${results.length}\n`);

  const bySize = new Map<number, number>();
  for (const r of results) {
    const n = r.intersection.length;
    bySize.set(n, (bySize.get(n) ?? 0) + 1);
  }
  console.log('Intersection result-set size distribution:');
  for (const [size, count] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${size.toString().padStart(3)} candidate(s): ${count} records`);
  }
  console.log();

  const exactlyOne = results.filter((r) => r.intersection.length === 1);
  console.log(`=== Records where token intersection yields EXACTLY ONE candidate: ${exactlyOne.length} ===\n`);
  for (const r of exactlyOne.slice(0, 40)) {
    console.log(
      `  "${r.acmsFullName}" (${r.acmsProfessionalId}) tokens=[${r.tokens.join(', ')}] -> "${r.intersection[0].name}" (${r.intersection[0].trusteeId})`,
    );
  }
  if (exactlyOne.length > 40) console.log(`  ... and ${exactlyOne.length - 40} more`);

  const smallSet = results.filter((r) => r.intersection.length >= 2 && r.intersection.length <= 4);
  console.log(`\n=== Records with a SMALL (2-4) intersection - still narrower than nothing: ${smallSet.length} ===\n`);
  for (const r of smallSet.slice(0, 20)) {
    const names = r.intersection.map((t) => t.name).join(' | ');
    console.log(`  "${r.acmsFullName}" (${r.acmsProfessionalId}) tokens=[${r.tokens.join(', ')}] -> ${names}`);
  }
  if (smallSet.length > 20) console.log(`  ... and ${smallSet.length - 20} more`);
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const x of a) if (b.has(x)) result.add(x);
  return result;
}

run();
