/**
 * Experiment (NOT a harness, not committed anywhere): for every no-match/ambiguous
 * trustee-professional-ids error record, find trustees whose first-lastName-token is a NEAR miss
 * (Levenshtein distance 1-2) but NOT an exact match to the ACMS lastName token - the population
 * calculateNameScore currently scores 0 outright with no partial credit. Report how many such
 * near-misses exist and how strong their address/phone/email corroboration is, so we can decide
 * with data whether a lastName edit-distance relaxation is worth adding.
 *
 * Usage: npx tsx --tsconfig backend/tsconfig.json /tmp/levenshtein-lastname-experiment.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateAddressScore,
  calculatePhoneScore,
  calculateEmailScore,
  firstLastNameToken,
} from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';
import { Trustee } from '../../../../common/src/cams/trustees';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

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

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);

  console.log(`Scanning ${errored.length} error records for near-miss lastName tokens...\n`);

  // Pre-index trustees by their first-lastName-token for fast lookup, but we need NEAR matches,
  // not exact - so bucket by token length +/-2 is not really helpful here; a full scan per
  // record against 5211 trustees is fine for a one-shot experiment (2229 * 5211 ~ 11.6M compares,
  // same order of magnitude the existing audit harness already does for Pass 2).
  const trusteeTokens = trustees.map((t) => ({
    trustee: t,
    token: firstLastNameToken(t.lastName),
  }));

  type NearMiss = {
    acmsFullName: string;
    acmsProfessionalId: string;
    acmsLastToken: string;
    disposition: string;
    trusteeId: string;
    trusteeName: string;
    trusteeLastToken: string;
    editDistance: number;
    addressScore: number;
    phoneScore: number | null;
    emailScore: number | null;
  };

  const nearMisses: NearMiss[] = [];
  let noVariantOrToken = 0;

  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsToken = firstLastNameToken(decoded.lastName);
    if (!acmsToken || acmsToken.length < 4) {
      // Too short a token for edit-distance 1-2 to be meaningful signal (e.g. "Wu" vs "Xu" is
      // already a 50% character change) - skip, consistent with a length floor a real
      // implementation would also need.
      noVariantOrToken++;
      continue;
    }

    const acmsTrustee = toAcmsTrusteeParty(decoded);

    let best: NearMiss | null = null;
    for (const { trustee, token } of trusteeTokens) {
      if (!token || token === acmsToken) continue; // exact matches are already handled elsewhere
      if (Math.abs(token.length - acmsToken.length) > 2) continue; // cheap pre-filter
      const dist = levenshtein(acmsToken, token);
      if (dist > 2) continue;

      const addressScore = calculateAddressScore(acmsTrustee.legacy, trustee.public.address);
      const phoneScore = calculatePhoneScore(acmsTrustee.legacy?.phone, trustee.public.phone);
      const emailScore = calculateEmailScore(acmsTrustee.legacy?.email, trustee.public.email);

      const candidate: NearMiss = {
        acmsFullName: acmsTrustee.fullName,
        acmsProfessionalId: record.acmsProfessionalId,
        acmsLastToken: acmsToken,
        disposition: record.error?.disposition ?? 'unknown',
        trusteeId: trustee.trusteeId,
        trusteeName: trustee.name,
        trusteeLastToken: token,
        editDistance: dist,
        addressScore,
        phoneScore,
        emailScore,
      };

      // Keep the strongest candidate per record (lowest edit distance, then best address score)
      if (
        !best ||
        candidate.editDistance < best.editDistance ||
        (candidate.editDistance === best.editDistance && candidate.addressScore > best.addressScore)
      ) {
        best = candidate;
      }
    }

    if (best) nearMisses.push(best);
  }

  console.log(`Records skipped (lastName token too short, <4 chars): ${noVariantOrToken}`);
  console.log(`Records with at least one lastName-token near-miss (edit distance 1-2): ${nearMisses.length}\n`);

  const byDistance = { 1: 0, 2: 0 };
  const strong: NearMiss[] = [];
  for (const nm of nearMisses) {
    byDistance[nm.editDistance as 1 | 2]++;
    const phoneOk = nm.phoneScore === null || nm.phoneScore >= 80;
    const emailOk = nm.emailScore === null || nm.emailScore >= 80;
    if (nm.addressScore >= 80 && phoneOk && emailOk && (nm.phoneScore !== null || nm.emailScore !== null || nm.addressScore >= 80)) {
      strong.push(nm);
    }
  }

  console.log('By edit distance:');
  console.log(`  distance=1: ${byDistance[1]}`);
  console.log(`  distance=2: ${byDistance[2]}\n`);

  console.log(`Strong corroboration (address>=80, phone/email not contradicting): ${strong.length}\n`);

  console.log('--- Strong corroboration detail ---');
  for (const nm of strong) {
    console.log(
      `  "${nm.acmsFullName}" (${nm.acmsProfessionalId}) [${nm.disposition}] lastName "${nm.acmsLastToken}" ` +
        `~ "${nm.trusteeLastToken}" (dist=${nm.editDistance}) -> "${nm.trusteeName}" (${nm.trusteeId}) ` +
        `[address=${nm.addressScore} phone=${nm.phoneScore} email=${nm.emailScore}]`,
    );
  }
  console.log();

  console.log('--- Sample: all near-misses (up to 60) ---');
  for (const nm of nearMisses.slice(0, 60)) {
    console.log(
      `  "${nm.acmsFullName}" (${nm.acmsProfessionalId}) [${nm.disposition}] lastName "${nm.acmsLastToken}" ` +
        `~ "${nm.trusteeLastToken}" (dist=${nm.editDistance}) -> "${nm.trusteeName}" (${nm.trusteeId}) ` +
        `[address=${nm.addressScore} phone=${nm.phoneScore} email=${nm.emailScore}]`,
    );
  }
  if (nearMisses.length > 60) {
    console.log(`  ... and ${nearMisses.length - 60} more`);
  }
}

run();
