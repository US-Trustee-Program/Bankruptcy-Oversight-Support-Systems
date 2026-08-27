/**
 * Follow-up to anchored-levenshtein-backtest.ts: measures the MARGINAL contribution of the
 * anchored-Levenshtein approach over the already-shipped findTokenIntersectionCandidates
 * (exact-word substring intersection). For each no-name-candidate record,
 * computes BOTH candidate sets and reports how many corroborated, exactly-one-candidate hits
 * come from anchored-Levenshtein alone (token-intersection found nothing or something different).
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/anchored-levenshtein-marginal-backtest.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateNameScore,
  calculateAddressScore,
  calculatePhoneScore,
  calculateEmailScore,
  tokenizeNameForIntersection,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const NAME_THRESHOLD = 85;
const MAX_EDIT_DISTANCE = 2;
const MIN_TOKEN_LENGTH_FOR_FUZZ = 3;
const ADDRESS_THRESHOLD = 80;

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
    if (fuzzValue === acmsFuzz) return false;
    return levenshtein(acmsFuzz, fuzzValue) <= MAX_EDIT_DISTANCE;
  });
}

function searchTrusteesByNameExact(token: string, trustees: Trustee[]): Trustee[] {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return trustees.filter((t) => pattern.test(t.name));
}

function tokenIntersectionCandidates(fullName: string, trustees: Trustee[]): Trustee[] {
  const tokens = tokenizeNameForIntersection(fullName);
  if (tokens.length < 2) return [];

  let candidateSet: Map<string, Trustee> | null = null;
  for (const token of tokens) {
    const matches = searchTrusteesByNameExact(token, trustees);
    const matchesById = new Map(matches.map((t) => [t.trusteeId, t]));
    if (candidateSet === null) {
      candidateSet = matchesById;
    } else {
      for (const id of candidateSet.keys()) {
        if (!matchesById.has(id)) candidateSet.delete(id);
      }
    }
    if (candidateSet.size === 0) break;
  }
  return candidateSet ? [...candidateSet.values()] : [];
}

function corroborated(addressScore: number, phoneScore: number | null, emailScore: number | null): boolean {
  return addressScore >= ADDRESS_THRESHOLD || phoneScore === 100 || emailScore === 100;
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

  let tokenIntersectionCorroboratedCount = 0;
  let levenshteinOnlyCorroboratedCount = 0;
  let bothCorroboratedCount = 0;
  const levenshteinOnlySamples: string[] = [];

  for (const { acmsFullName, acmsProfessionalId, decoded } of noNameCandidateRecords) {
    const acmsTrustee = toAcmsTrusteeParty(decoded);

    const tiCandidates = tokenIntersectionCandidates(acmsFullName, trustees);
    const tiCorroboratedSet = tiCandidates.filter((t) => {
      const addressScore = calculateAddressScore(acmsTrustee.legacy, t.public.address);
      const phoneScore = calculatePhoneScore(acmsTrustee.legacy?.phone, t.public.phone);
      const emailScore = calculateEmailScore(acmsTrustee.legacy?.email, t.public.email);
      return corroborated(addressScore, phoneScore, emailScore);
    });
    const tiResolved = tiCandidates.length === 1 && tiCorroboratedSet.length === 1;

    const acmsFirst = firstToken(decoded.firstName);
    const acmsLast = firstToken(decoded.lastName);
    let levCandidates: Trustee[] = [];
    if (acmsFirst && acmsLast) {
      const viaLastAnchor = anchoredFuzzyMatch(acmsLast, acmsFirst, trustees, 'lastName', 'firstName');
      const viaFirstAnchor = anchoredFuzzyMatch(acmsFirst, acmsLast, trustees, 'firstName', 'lastName');
      const byId = new Map<string, Trustee>();
      for (const t of [...viaLastAnchor, ...viaFirstAnchor]) byId.set(t.trusteeId, t);
      levCandidates = [...byId.values()];
    }
    const levCorroboratedSet = levCandidates.filter((t) => {
      const addressScore = calculateAddressScore(acmsTrustee.legacy, t.public.address);
      const phoneScore = calculatePhoneScore(acmsTrustee.legacy?.phone, t.public.phone);
      const emailScore = calculateEmailScore(acmsTrustee.legacy?.email, t.public.email);
      return corroborated(addressScore, phoneScore, emailScore);
    });
    const levResolved = levCorroboratedSet.length === 1;

    if (tiResolved) tokenIntersectionCorroboratedCount++;
    if (levResolved && !tiResolved) {
      levenshteinOnlyCorroboratedCount++;
      if (levenshteinOnlySamples.length < 40) {
        levenshteinOnlySamples.push(
          `  "${acmsFullName}" (${acmsProfessionalId}) -> "${levCorroboratedSet[0].name}" (${levCorroboratedSet[0].trusteeId})`,
        );
      }
    }
    if (levResolved && tiResolved) bothCorroboratedCount++;
  }

  console.log(`no-name-candidate population: ${noNameCandidateRecords.length}\n`);
  console.log(`Token-intersection resolves (corroborated, exactly one): ${tokenIntersectionCorroboratedCount}`);
  console.log(`Anchored-Levenshtein resolves ADDITIONALLY (token-intersection did not): ${levenshteinOnlyCorroboratedCount}`);
  console.log(`Both approaches independently resolve the same record: ${bothCorroboratedCount}\n`);

  console.log('--- Marginal anchored-Levenshtein hits (up to 40) ---');
  console.log(levenshteinOnlySamples.join('\n'));
}

run();
