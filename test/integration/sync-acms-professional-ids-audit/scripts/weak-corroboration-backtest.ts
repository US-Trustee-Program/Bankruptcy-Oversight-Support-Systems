/**
 * Backtest for the "name-only-insufficient-corroboration" bucket (exactly one
 * candidate clears nameScore>=85, but none of addressScore>=80/phoneScore==100/emailScore==100
 * clears the OR-rule), splits the 379 records by whether phoneScore/emailScore are
 * ABSENT (null - no data to compare) vs. actively CONTRADICTING (0 - both sides had comparable
 * data and it genuinely disagreed). addressScore is never null (see calculateAddressScore's doc
 * comment - it always returns a number, 0 when parseCityStateZip fails or truly dissimilar), so
 * this backtest treats a LOW addressScore as informational only, not as a contradiction signal on
 * its own - low address scores in this name=100 population were hand-verified as usually
 * stale/moved offices, not different people.
 *
 * The open question this answers: is it safe to auto-link a single unambiguous name-qualifying
 * candidate when address/phone/email are merely ABSENT (no data to corroborate OR contradict),
 * or does a meaningful fraction of this bucket have a phoneScore/emailScore of exactly 0 (an
 * ACTIVE disagreement) that should keep blocking auto-link?
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/weak-corroboration-backtest.ts
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
const NAME_THRESHOLD = 85;
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

type Scored = {
  trusteeId: string;
  trusteeName: string;
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
  emailScore: number | null;
};

function scoreAgainst(acmsTrustee: DxtrTrusteeParty, trustee: Trustee): Scored {
  return {
    trusteeId: trustee.trusteeId,
    trusteeName: trustee.name,
    nameScore: calculateNameScore(acmsTrustee, trustee),
    addressScore: calculateAddressScore(acmsTrustee.legacy, trustee.public.address),
    phoneScore: calculatePhoneScore(acmsTrustee.legacy?.phone, trustee.public.phone),
    emailScore: calculateEmailScore(acmsTrustee.legacy?.email, trustee.public.email),
  };
}

function findQualifyingCandidates(acmsTrustee: DxtrTrusteeParty, trustees: Trustee[]): Scored[] {
  const qualifying: Scored[] = [];
  for (const trustee of trustees) {
    const nameScore = calculateNameScore(acmsTrustee, trustee);
    if (nameScore < NAME_THRESHOLD) continue;
    qualifying.push(scoreAgainst(acmsTrustee, trustee));
  }
  return qualifying;
}

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);

  const insufficientCorroboration: {
    acmsFullName: string;
    acmsProfessionalId: string;
    c: Scored;
    acmsAddressParseable: boolean;
  }[] = [];

  let skippedBlankDemographic = 0;

  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);

    // Brian: if ACMS gave us NO demographic signal at all beyond the name itself (no address, no
    // phone, no email), that is not "nothing to contradict" - it is an absence of ANY evidence to
    // corroborate with, which is a materially weaker basis for auto-linking than the other cases
    // in this bucket (which all have at least some real, if stale, signal). Skip these entirely -
    // they should stay exactly as they are today (name-only match, human review), not be folded
    // into a "safe to relax" population just because nothing technically contradicts.
    const addressBlank = !decoded.address1?.trim() && !decoded.cityStateZipCountry?.trim();
    const phoneBlank = !decoded.phone?.trim() || decoded.phone.trim() === '0';
    const emailBlank = !decoded.email?.trim();
    if (addressBlank && phoneBlank && emailBlank) {
      skippedBlankDemographic++;
      continue;
    }

    const acmsTrustee = toAcmsTrusteeParty(decoded);
    const qualifying = findQualifyingCandidates(acmsTrustee, trustees);
    if (qualifying.length !== 1) continue;

    const c = qualifying[0];
    const corroborated = c.addressScore >= ADDRESS_THRESHOLD || c.phoneScore === 100 || c.emailScore === 100;
    if (corroborated) continue;

    insufficientCorroboration.push({
      acmsFullName: acmsTrustee.fullName,
      acmsProfessionalId: record.acmsProfessionalId,
      c,
      // True when ACMS actually recorded a parseable city/state/zip - a LOW addressScore against
      // a parseable ACMS address means the two addresses were compared and genuinely differ (a
      // real signal, e.g. different city/state entirely), NOT "nothing to compare" - see
      // NY-00084 (Robert B. Schindler): ACMS has a real Charleston SC address, CAMS has New York,
      // addressScore=0 - that is a contradiction, not an absence, even though it looks identical
      // to a record with a genuinely blank ACMS address at the addressScore level alone.
      acmsAddressParseable: parseCityStateZip(decoded.cityStateZipCountry) !== null,
    });
  }

  console.log(`Skipped (fully blank ACMS demographic - no address/phone/email at all): ${skippedBlankDemographic}`);
  console.log(`name-only-insufficient-corroboration total (excluding blank demographics): ${insufficientCorroboration.length}\n`);

  const contradicting = insufficientCorroboration.filter(
    ({ c, acmsAddressParseable }) =>
      c.phoneScore === 0 || c.emailScore === 0 || (acmsAddressParseable && c.addressScore < 30),
  );
  const absentOnly = insufficientCorroboration.filter(
    ({ c, acmsAddressParseable }) =>
      c.phoneScore !== 0 && c.emailScore !== 0 && (!acmsAddressParseable || c.addressScore >= 30),
  );

  console.log(
    `  phone/email ACTIVELY CONTRADICTING (phoneScore===0 or emailScore===0): ${contradicting.length} ` +
      `(${((100 * contradicting.length) / insufficientCorroboration.length).toFixed(1)}%)`,
  );
  console.log(
    `  phone/email ABSENT ONLY (both null - nothing to contradict, address alone is weak/low): ${absentOnly.length} ` +
      `(${((100 * absentOnly.length) / insufficientCorroboration.length).toFixed(1)}%)\n`,
  );

  console.log('--- Sample: phone/email ACTIVELY CONTRADICTING (up to 20) ---');
  for (const { acmsFullName, acmsProfessionalId, c } of contradicting.slice(0, 20)) {
    console.log(
      `  "${acmsFullName}" (${acmsProfessionalId}) -> "${c.trusteeName}" (${c.trusteeId}) ` +
        `[name=${c.nameScore} address=${c.addressScore} phone=${c.phoneScore} email=${c.emailScore}]`,
    );
  }
  if (contradicting.length > 20) console.log(`  ... and ${contradicting.length - 20} more`);

  console.log('\n--- Sample: phone/email ABSENT ONLY, by addressScore ascending (up to 30) ---');
  const sortedAbsent = [...absentOnly].sort((a, b) => a.c.addressScore - b.c.addressScore);
  for (const { acmsFullName, acmsProfessionalId, c } of sortedAbsent.slice(0, 30)) {
    console.log(
      `  "${acmsFullName}" (${acmsProfessionalId}) -> "${c.trusteeName}" (${c.trusteeId}) ` +
        `[name=${c.nameScore} address=${c.addressScore} phone=${c.phoneScore} email=${c.emailScore}]`,
    );
  }
  if (sortedAbsent.length > 30) console.log(`  ... and ${sortedAbsent.length - 30} more`);

  // Further split absentOnly by nameScore: 100 (exact/near-exact) vs 85 (fuzzy initial-level) -
  // approach #2 in the bead considers whether ONLY the strictest name=100 tier is safe to relax.
  const name100 = absentOnly.filter(({ c }) => c.nameScore === 100);
  const name85 = absentOnly.filter(({ c }) => c.nameScore < 100);
  console.log(`\nWithin "absent only": nameScore===100: ${name100.length}, nameScore<100 (85-99 tier): ${name85.length}`);
}

run();
