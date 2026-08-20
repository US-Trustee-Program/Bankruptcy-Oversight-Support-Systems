/**
 * Exploratory audit: do the persisted TRUSTEE_VARIATION records still line up with the CAMS
 * trustee they were recorded against?
 *
 * Investigation only — makes NO changes to any collection or to the as-built matching logic.
 * Each TRUSTEE_VARIATION document (../fixtures/trustee-variants.json, a raw export of the
 * trustee-variation collection) captures a DXTR trustee-party snapshot ("variant", a JSON string
 * — see buildVariant in backend/lib/use-cases/dataflows/trustee-variant.helpers.ts) alongside the
 * trusteeId it was auto-linked or human-approved to at that moment. This harness decodes every
 * variant, looks up its trusteeId in a CAMS trustees export (../fixtures/2026-08-18-trustees.json),
 * and scores the variant's demographics against that trustee using the SAME scoring functions
 * production matching uses (calculateNameScore, calculateAddressScore, calculatePhoneScore,
 * calculateEmailScore from trustee-match.helpers.ts) — not a new, separately-tuned comparison.
 * The goal is to surface any variant whose demographics look like a poor match for the trustee it
 * points to, which would mean a past auto-link (or human approval) associated the wrong person —
 * exactly the failure mode the Drummond/Brandon professional-id investigation (cams-hbsla) raised
 * concern about, but for the TRUSTEE_VARIATION fast path instead of the professional-id fast path.
 *
 * This is a one-shot script - NOT a Vitest test. No database is used; both fixture files are read
 * directly and compared in memory.
 *
 * Usage (from test/integration/):
 *   npm run trustee-variation-audit
 *
 * Required fixtures (place in fixtures/ — gitignored, real trustee PII, never committed):
 *   trustee-variants.json    Raw export of the trustee-variation collection (TRUSTEE_VARIATION docs)
 *   2026-08-18-trustees.json Raw export of the trustees collection ({"documentType":"TRUSTEE"} docs)
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

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

type MongoExtendedId = { $oid?: string } | string | undefined;

type TrusteeVariationRecord = {
  id: string;
  fingerprint: string;
  variant: string;
  trusteeId: string;
};

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

function loadVariants(): TrusteeVariationRecord[] {
  const variantsPath = path.join(FIXTURES_DIR, 'trustee-variants.json');
  const raw: (TrusteeVariationRecord & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(variantsPath, 'utf-8'),
  );
  return raw.map(stripMongoId);
}

function loadTrusteesById(): Map<string, Trustee> {
  const trusteesPath = path.join(FIXTURES_DIR, '2026-08-18-trustees.json');
  const raw: (Trustee & { _id?: MongoExtendedId })[] = JSON.parse(
    fs.readFileSync(trusteesPath, 'utf-8'),
  );
  return new Map(raw.map((doc) => [doc.trusteeId, stripMongoId(doc) as Trustee]));
}

/**
 * Decodes a variant's JSON string (see buildVariant) and reshapes it into a DxtrTrusteeParty so
 * this harness can call the exact same scoring functions production matching uses, unmodified.
 */
function toDxtrTrusteeParty(variant: DecodedVariant): DxtrTrusteeParty {
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

type AuditResult = {
  variationId: string;
  fingerprint: string;
  trusteeId: string;
  trusteeFound: boolean;
  dxtrFullName: string;
  camsName?: string;
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
  emailScore: number | null;
  concern: 'trustee-not-found' | 'name-mismatch' | 'weak-corroboration' | 'none';
};

// A variant's own composed name doesn't always match calculateNameScore's discrete-field
// requirements as cleanly as a live sync event would (e.g. a variant recorded before a
// normalization fix landed) - so this audit flags anything with a real nameScore below 100 for
// visual review, rather than silently treating 85 (an initial-vs-full relationship) as fine.
const NAME_MISMATCH_THRESHOLD = 85;

function classifyConcern(nameScore: number, addressScore: number): AuditResult['concern'] {
  if (nameScore < NAME_MISMATCH_THRESHOLD) return 'name-mismatch';
  if (addressScore === 0) return 'weak-corroboration';
  return 'none';
}

function auditVariant(
  variation: TrusteeVariationRecord,
  trusteesById: Map<string, Trustee>,
): AuditResult {
  const decoded: DecodedVariant = JSON.parse(variation.variant);
  const dxtrTrustee = toDxtrTrusteeParty(decoded);
  const trustee = trusteesById.get(variation.trusteeId);

  if (!trustee) {
    return {
      variationId: variation.id,
      fingerprint: variation.fingerprint,
      trusteeId: variation.trusteeId,
      trusteeFound: false,
      dxtrFullName: dxtrTrustee.fullName,
      nameScore: 0,
      addressScore: 0,
      phoneScore: null,
      emailScore: null,
      concern: 'trustee-not-found',
    };
  }

  const nameScore = calculateNameScore(dxtrTrustee, trustee);
  const addressScore = calculateAddressScore(dxtrTrustee.legacy, trustee.public.address);
  const phoneScore = calculatePhoneScore(dxtrTrustee.legacy?.phone, trustee.public.phone);
  const emailScore = calculateEmailScore(dxtrTrustee.legacy?.email, trustee.public.email);

  return {
    variationId: variation.id,
    fingerprint: variation.fingerprint,
    trusteeId: variation.trusteeId,
    trusteeFound: true,
    dxtrFullName: dxtrTrustee.fullName,
    camsName: trustee.name,
    nameScore,
    addressScore,
    phoneScore,
    emailScore,
    concern: classifyConcern(nameScore, addressScore),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function run() {
  console.log('\nAuditing TRUSTEE_VARIATION records against the CAMS trustees export...\n');

  const variants = loadVariants();
  const trusteesById = loadTrusteesById();

  console.log(`Loaded ${variants.length} variation records, ${trusteesById.size} trustees.\n`);

  const results = variants.map((v) => auditVariant(v, trusteesById));

  const counts = {
    none: 0,
    'name-mismatch': 0,
    'weak-corroboration': 0,
    'trustee-not-found': 0,
  };
  for (const r of results) counts[r.concern]++;

  console.log('Outcome summary:');
  for (const [concern, count] of Object.entries(counts)) {
    console.log(`  ${concern.padEnd(20)} ${count}`);
  }

  console.log(
    '\nDetail — trustee-not-found (variant points to a trusteeId absent from the trustees export):',
  );
  for (const r of results.filter((r) => r.concern === 'trustee-not-found')) {
    console.log(`  "${r.dxtrFullName}" -> missing trusteeId ${r.trusteeId}`);
  }

  console.log(
    `\nDetail — name-mismatch (nameScore < ${NAME_MISMATCH_THRESHOLD} - the variant's own ` +
      'demographics do not cleanly match the trustee it is linked to):',
  );
  for (const r of results.filter((r) => r.concern === 'name-mismatch')) {
    console.log(
      `  "${r.dxtrFullName}" -> "${r.camsName}" (trusteeId ${r.trusteeId}) ` +
        `[name=${r.nameScore} address=${r.addressScore} phone=${r.phoneScore} email=${r.emailScore}]`,
    );
  }

  console.log(
    '\nDetail — weak-corroboration (name matched, but address could not corroborate at all - ' +
      'addressScore 0 typically means unparseable/missing DXTR address data, not necessarily a ' +
      'wrong match, but worth a human glance):',
  );
  for (const r of results.filter((r) => r.concern === 'weak-corroboration')) {
    console.log(
      `  "${r.dxtrFullName}" -> "${r.camsName}" (trusteeId ${r.trusteeId}) ` +
        `[name=${r.nameScore} address=${r.addressScore} phone=${r.phoneScore} email=${r.emailScore}]`,
    );
  }

  console.log(`\nReplayed ${results.length} variation records.\n`);
}

run();
