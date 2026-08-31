/**
 * Experiment (NOT a harness, not committed anywhere): backtests a proposed auto-link rule for
 * ACMS professional-id no-match/ambiguous records against the real 2026-08-26 export - "would
 * this record have auto-linked under rule X, and does the winning candidate actually look
 * correct by hand?"
 *
 * Rule under test: nameScore >= 85 AND (addressScore >= 80 OR phoneScore == 100 OR
 * emailScore == 100), with no independently-computed "contradiction" check yet (see caveats
 * printed at the end) - this is the simplest form of the OR-of-strong-signals idea discussed
 * before rather than a final design.
 *
 * Reuses the SAME calculateNameScore/calculateAddressScore/calculatePhoneScore/
 * calculateEmailScore production functions the sync-acms-professional-ids-audit harness uses -
 * not a new, separately-tuned comparison.
 *
 * Usage: npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/auto-link-threshold-backtest.ts
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

/**
 * Finds every candidate scoring nameScore >= NAME_THRESHOLD (not just the single best) - unlike
 * the audit harness's findBestCandidate (which reports one best-guess candidate for a human
 * reviewer to glance at), an auto-link decision must know whether there's a SECOND candidate
 * that also clears the name bar, since auto-linking to a non-unique name match would be unsafe
 * regardless of how strong the contact-field corroboration is.
 */
function findQualifyingCandidates(acmsTrustee: DxtrTrusteeParty, trustees: Trustee[]): Scored[] {
  const qualifying: Scored[] = [];
  for (const trustee of trustees) {
    const nameScore = calculateNameScore(acmsTrustee, trustee);
    if (nameScore < NAME_THRESHOLD) continue;
    qualifying.push(scoreAgainst(acmsTrustee, trustee));
  }
  return qualifying;
}

type Verdict =
  | { kind: 'no-name-candidate' }
  | { kind: 'multiple-name-candidates'; candidates: Scored[] }
  | { kind: 'would-auto-link'; candidate: Scored }
  | { kind: 'name-only-insufficient-corroboration'; candidate: Scored };

function classify(acmsTrustee: DxtrTrusteeParty, trustees: Trustee[]): Verdict {
  const qualifying = findQualifyingCandidates(acmsTrustee, trustees);
  if (qualifying.length === 0) return { kind: 'no-name-candidate' };
  if (qualifying.length > 1) return { kind: 'multiple-name-candidates', candidates: qualifying };

  const c = qualifying[0];
  const corroborated =
    c.addressScore >= ADDRESS_THRESHOLD || c.phoneScore === 100 || c.emailScore === 100;

  if (corroborated) return { kind: 'would-auto-link', candidate: c };
  return { kind: 'name-only-insufficient-corroboration', candidate: c };
}

function run() {
  const records = loadProfessionalIds();
  const trustees = loadTrustees();
  const errored = records.filter((r) => r.error && r.variant);

  console.log(`Backtesting auto-link rule against ${errored.length} error records...`);
  console.log(`Rule: nameScore >= ${NAME_THRESHOLD} AND EXACTLY ONE qualifying candidate AND `);
  console.log(`      (addressScore >= ${ADDRESS_THRESHOLD} OR phoneScore == 100 OR emailScore == 100)\n`);

  const results: { record: TrusteeProfessionalId; acmsTrustee: DxtrTrusteeParty; verdict: Verdict }[] =
    [];

  for (const record of errored) {
    const decoded: DecodedVariant = JSON.parse(record.variant!);
    const acmsTrustee = toAcmsTrusteeParty(decoded);
    const verdict = classify(acmsTrustee, trustees);
    results.push({ record, acmsTrustee, verdict });
  }

  const counts = {
    'no-name-candidate': 0,
    'multiple-name-candidates': 0,
    'would-auto-link': 0,
    'name-only-insufficient-corroboration': 0,
  };
  for (const r of results) counts[r.verdict.kind]++;

  console.log('Outcome distribution:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(38)} ${v}`);
  }
  console.log();

  const autoLinked = results.filter((r) => r.verdict.kind === 'would-auto-link');
  console.log(`=== Would auto-link: ${autoLinked.length} records ===\n`);
  for (const r of autoLinked) {
    const c = (r.verdict as { candidate: Scored }).candidate;
    console.log(
      `  "${r.acmsTrustee.fullName}" (${r.record.acmsProfessionalId}) [${r.record.error?.disposition}] -> ` +
        `"${c.trusteeName}" (${c.trusteeId}) [name=${c.nameScore} address=${c.addressScore} phone=${c.phoneScore} email=${c.emailScore}]`,
    );
  }

  console.log(`\n=== Ambiguous under this rule (2+ candidates clear nameScore>=${NAME_THRESHOLD}): ${counts['multiple-name-candidates']} ===`);
  const multi = results.filter((r) => r.verdict.kind === 'multiple-name-candidates').slice(0, 15);
  for (const r of multi) {
    const cands = (r.verdict as { candidates: Scored[] }).candidates;
    const list = cands.map((c) => `${c.trusteeName} (addr=${c.addressScore})`).join(' | ');
    console.log(`  "${r.acmsTrustee.fullName}" (${r.record.acmsProfessionalId}) -> ${list}`);
  }
  if (counts['multiple-name-candidates'] > 15) {
    console.log(`  ... and ${counts['multiple-name-candidates'] - 15} more`);
  }

  console.log(
    `\nCaveats: this backtest does NOT yet model a "contradicting evidence" check (e.g. a ` +
      `strongly MISMATCHED address/phone should arguably block auto-link even if another field ` +
      `corroborates) - the OR rule as tested treats a missing/low field as neutral, same as ` +
      `production's existing calculatePhoneScore/calculateEmailScore null-when-incomparable ` +
      `semantics, but a genuinely conflicting low score is not distinguished from a merely-absent ` +
      `one in THIS experiment. Worth a follow-up pass before finalizing.`,
  );
}

run();
