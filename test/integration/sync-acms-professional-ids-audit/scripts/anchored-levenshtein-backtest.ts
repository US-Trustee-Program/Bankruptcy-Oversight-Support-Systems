/**
 * Experiment: for each ACMS no-name-candidate record NOT already caught by
 * findTokenIntersectionCandidates (the shipped exact-word-containment intersection - see
 * cams-e75yv), try an anchored Levenshtein approach instead: anchor ONE name part with an exact
 * match, then allow the OTHER part to be a close (edit-distance <=1 or <=2) match rather than
 * requiring exact containment. Two directions, unioned:
 *   A) lastName exact match -> firstName fuzzy (catches a firstName typo/OCR error on an
 *      otherwise-correct lastName, e.g. "Jonh" vs "John")
 *   B) firstName exact match -> lastName fuzzy (catches a lastName typo, e.g. "Andersen" vs
 *      "Anderson" - already partially covered by calculateNameScore's exact-token lastName
 *      requirement being the ONE thing standing in the way)
 *
 * This is a narrower, more targeted use of Levenshtein than the earlier abandoned experiment
 * (levenshtein-lastname-experiment.ts), which fuzzed lastName alone against the ENTIRE trustee
 * population with no anchor and found 1637 noisy candidate records collapsing to only 4
 * legitimate matches after requiring strong address corroboration. Anchoring one side first
 * should narrow the candidate pool before ever computing an edit distance, the same way
 * token-intersection's precision comes from requiring BOTH tokens to already narrow the pool
 * rather than fuzzing on a single, unanchored dimension.
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/anchored-levenshtein-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateNameScore,
  calculateAddressScore,
  calculatePhoneScore,
  calculateEmailScore,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const NAME_THRESHOLD = 85;
const MAX_EDIT_DISTANCE = 2;
const MIN_TOKEN_LENGTH_FOR_FUZZ = 3; // a 1-2 char token has too many trustees within distance 1-2

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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function normalizeToken(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

function firstToken(s: string | undefined): string {
  return normalizeToken(s).split(/\s+/)[0] ?? normalizeToken(s);
}

/**
 * Anchored fuzzy search: trustees whose ANCHOR field token exactly matches acmsAnchor, and whose
 * FUZZ field token is within MAX_EDIT_DISTANCE of acmsFuzz.
 */
function anchoredFuzzyMatch(
  acmsAnchor: string,
  acmsFuzz: string,
  trustees: Trustee[],
  anchorField: 'firstName' | 'lastName',
  fuzzField: 'firstName' | 'lastName',
): Trustee[] {
  if (!acmsAnchor || !acmsFuzz) return [];
  if (acmsFuzz.length < MIN_TOKEN_LENGTH_FOR_FUZZ) return [];

  return trustees.filter((t) => {
    const anchorValue = firstToken(anchorField === 'firstName' ? t.firstName : t.lastName);
    if (anchorValue !== acmsAnchor) return false;
    const fuzzValue = firstToken(fuzzField === 'firstName' ? t.firstName : t.lastName);
    if (!fuzzValue) return false;
    if (fuzzValue === acmsFuzz) return false; // exact match already covered by existing tiers
    return levenshtein(acmsFuzz, fuzzValue) <= MAX_EDIT_DISTANCE;
  });
}

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();

  const placeholderPattern = /\bno trustee\b/i;
  const errored = records.filter((r) => r.error && r.variant);

  const noNameCandidateRecords: { acmsFullName: string; acmsProfessionalId: string; decoded: DecodedVariant }[] =
    [];
  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrustee = toAcmsTrusteeParty(decoded);
    if (placeholderPattern.test(acmsTrustee.fullName)) continue;

    let qualifies = false;
    for (const trustee of trustees) {
      if (calculateNameScore(acmsTrustee, trustee) >= NAME_THRESHOLD) {
        qualifies = true;
        break;
      }
    }
    if (!qualifies) {
      noNameCandidateRecords.push({ acmsFullName: acmsTrustee.fullName, acmsProfessionalId: record.acmsProfessionalId, decoded });
    }
  }

  console.log(`no-name-candidate population (excluding placeholders): ${noNameCandidateRecords.length}\n`);

  type Result = {
    acmsFullName: string;
    acmsProfessionalId: string;
    decoded: DecodedVariant;
    candidates: Trustee[];
    via: string;
  };
  const results: Result[] = [];

  for (const { acmsFullName, acmsProfessionalId, decoded } of noNameCandidateRecords) {
    const acmsFirst = firstToken(decoded.firstName);
    const acmsLast = firstToken(decoded.lastName);
    if (!acmsFirst || !acmsLast) continue;

    const viaLastAnchor = anchoredFuzzyMatch(acmsLast, acmsFirst, trustees, 'lastName', 'firstName');
    const viaFirstAnchor = anchoredFuzzyMatch(acmsFirst, acmsLast, trustees, 'firstName', 'lastName');

    const byId = new Map<string, { trustee: Trustee; via: string[] }>();
    for (const t of viaLastAnchor) {
      const entry = byId.get(t.trusteeId) ?? { trustee: t, via: [] };
      entry.via.push('lastName-anchor');
      byId.set(t.trusteeId, entry);
    }
    for (const t of viaFirstAnchor) {
      const entry = byId.get(t.trusteeId) ?? { trustee: t, via: [] };
      entry.via.push('firstName-anchor');
      byId.set(t.trusteeId, entry);
    }

    if (byId.size > 0) {
      results.push({
        acmsFullName,
        acmsProfessionalId,
        decoded,
        candidates: [...byId.values()].map((e) => e.trustee),
        via: [...byId.values()].map((e) => e.via.join('+')).join(', '),
      });
    }
  }

  console.log(`Records with at least one anchored-Levenshtein candidate: ${results.length}\n`);

  const bySize = new Map<number, number>();
  for (const r of results) bySize.set(r.candidates.length, (bySize.get(r.candidates.length) ?? 0) + 1);
  console.log('Candidate-count distribution:');
  for (const [size, count] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${size} candidate(s): ${count} records`);
  }
  console.log();

  const ADDRESS_THRESHOLD = 80;
  const corroborated = (addressScore: number, phoneScore: number | null, emailScore: number | null) =>
    addressScore >= ADDRESS_THRESHOLD || phoneScore === 100 || emailScore === 100;

  const exactlyOne = results.filter((r) => r.candidates.length === 1);
  console.log(`=== Exactly one candidate: ${exactlyOne.length} ===\n`);

  const exactlyOneScored = exactlyOne.map((r) => {
    const acmsTrustee = toAcmsTrusteeParty(r.decoded);
    const t = r.candidates[0];
    const addressScore = calculateAddressScore(acmsTrustee.legacy, t.public.address);
    const phoneScore = calculatePhoneScore(acmsTrustee.legacy?.phone, t.public.phone);
    const emailScore = calculateEmailScore(acmsTrustee.legacy?.email, t.public.email);
    return { r, t, addressScore, phoneScore, emailScore };
  });

  const wouldAutoLink = exactlyOneScored.filter((x) => corroborated(x.addressScore, x.phoneScore, x.emailScore));
  const needsReview = exactlyOneScored.filter((x) => !corroborated(x.addressScore, x.phoneScore, x.emailScore));

  console.log(`Of those, WOULD AUTO-LINK (corroborated by address>=80/phone==100/email==100): ${wouldAutoLink.length}`);
  console.log(`Of those, candidate found but NOT corroborated (still needs human review): ${needsReview.length}\n`);

  console.log('--- WOULD AUTO-LINK (all) ---');
  for (const x of wouldAutoLink) {
    console.log(
      `  "${x.r.acmsFullName}" (${x.r.acmsProfessionalId}) [${x.r.via}] -> "${x.t.name}" (${x.t.trusteeId}) ` +
        `[address=${x.addressScore} phone=${x.phoneScore} email=${x.emailScore}]`,
    );
  }

  console.log('\n--- Candidate found, NOT corroborated (sample of 20) ---');
  for (const x of needsReview.slice(0, 20)) {
    console.log(
      `  "${x.r.acmsFullName}" (${x.r.acmsProfessionalId}) [${x.r.via}] -> "${x.t.name}" (${x.t.trusteeId}) ` +
        `[address=${x.addressScore} phone=${x.phoneScore} email=${x.emailScore}]`,
    );
  }

  const smallSet = results.filter((r) => r.candidates.length >= 2 && r.candidates.length <= 4);
  console.log(`\n=== 2-4 candidates: ${smallSet.length} ===\n`);
  for (const r of smallSet) {
    const acmsTrustee = toAcmsTrusteeParty(r.decoded);
    const scored = r.candidates.map((t) => {
      const addressScore = calculateAddressScore(acmsTrustee.legacy, t.public.address);
      const phoneScore = calculatePhoneScore(acmsTrustee.legacy?.phone, t.public.phone);
      const emailScore = calculateEmailScore(acmsTrustee.legacy?.email, t.public.email);
      return { t, addressScore, phoneScore, emailScore };
    });
    const corroboratedOnes = scored.filter((s) => corroborated(s.addressScore, s.phoneScore, s.emailScore));
    const names = scored
      .map((s) => `${s.t.name} [addr=${s.addressScore} phone=${s.phoneScore} email=${s.emailScore}]`)
      .join(' | ');
    const flag = corroboratedOnes.length === 1 ? ' <<< exactly one corroborated' : '';
    console.log(`  "${r.acmsFullName}" (${r.acmsProfessionalId})${flag} -> ${names}`);
  }
}

run();
