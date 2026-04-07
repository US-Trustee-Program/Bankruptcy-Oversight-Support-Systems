/**
 * Seed test trustees and match verification documents for local testing.
 *
 * CAMS-596: Seeds trustees with/without TrusteeProfessionalId records to test
 *   the professionalId migration and lookup functionality.
 *
 * CAMS-713 Slice 3: Seeds TrusteeMatchVerification documents covering all
 *   non-auto-match outcomes so the skip-resolved/skip-dismissed logic and
 *   upsert-pending logic can be exercised locally.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/migration/trustee/scripts/seed-test-trustees.ts \
 *     [command]
 *
 * Commands:
 *   seed-proid               Create trustees WITH proIds, WITHOUT proIds, and an ambiguous duplicate pair
 *   seed-match-verification  Create TrusteeMatchVerification docs for all slice 3 outcomes
 *   list                     Show seeded test data currently in MongoDB
 *   clean                    Delete all seeded test data from MongoDB
 *   help                     Show this message
 */

import * as dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import { TrusteeInput } from '../../../../common/src/cams/trustees';
import { CamsUserReference } from '../../../../common/src/cams/users';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
} from '../../../../common/src/cams/trustee-match-verification';
import { TrusteeAppointmentSyncErrorCode } from '../../../../common/src/cams/dataflow-events';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

dotenv.config({ path: 'backend/.env' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All seeded trustee names start with this prefix for easy identification and cleanup. */
const SEED_NAME_PREFIX = 'SEED Test ';

/** All seeded verification case IDs use this division code prefix for easy identification and cleanup. */
const SEED_CASE_PREFIX = 'TST-';

const SEED_COURT_ID = '091';

const SEED_SYSTEM_USER: CamsUserReference = {
  id: 'SEED-SCRIPT',
  name: 'Seed Test Script',
};

// ---------------------------------------------------------------------------
// Trustee definitions
// ---------------------------------------------------------------------------

type TrusteeSeedWithProId = { name: string; state: string; proId: string };
type TrusteeSeedNoProId = { name: string; state: string };

const TRUSTEES_WITH_PROID: TrusteeSeedWithProId[] = [
  { name: 'SEED Test Alice Proid', state: 'NY', proId: 'NY-SEED-001' },
  { name: 'SEED Test Bob Proid', state: 'CA', proId: 'CA-SEED-002' },
  { name: 'SEED Test Carol Proid', state: 'TX', proId: 'TX-SEED-003' },
];

const TRUSTEES_WITHOUT_PROID: TrusteeSeedNoProId[] = [
  { name: 'SEED Test David Noproid', state: 'FL' },
  { name: 'SEED Test Eve Noproid', state: 'IL' },
  { name: 'SEED Test Frank Noproid', state: 'OH' },
  // Two trustees with identical names to trigger the "ambiguous" outcome in zoom CSV import.
  { name: 'SEED Test Ambiguous Duplicate', state: 'MA' },
  { name: 'SEED Test Ambiguous Duplicate', state: 'WA' },
];

function makeTrusteeInput(name: string, state: string): TrusteeInput {
  return {
    name,
    public: {
      address: {
        address1: '123 Seed Street',
        city: 'Testville',
        state,
        zipCode: '00000',
        countryCode: 'US',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Match verification definitions
// ---------------------------------------------------------------------------

type VerificationSeed = {
  caseId: string;
  dxtrFullName: string;
  mismatchReason: TrusteeAppointmentSyncErrorCode;
  status: 'pending' | 'approved' | 'rejected';
  candidateCount: number;
  note: string;
};

const VERIFICATION_SEEDS: VerificationSeed[] = [
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'Unknown Trustee NoMatch',
    mismatchReason: TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
    status: 'pending',
    candidateCount: 0,
    note: 'No CAMS trustee name match — pending manual resolution',
  },
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'Common Name MultipleMatch',
    mismatchReason: TrusteeAppointmentSyncErrorCode.MultipleTrusteesMatch,
    status: 'pending',
    candidateCount: 2,
    note: 'Multiple name matches (ambiguous) — pending manual resolution',
  },
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'Alice Imperfect Match',
    mismatchReason: TrusteeAppointmentSyncErrorCode.ImperfectMatch,
    status: 'pending',
    candidateCount: 1,
    note: 'Single low-confidence candidate — pending manual resolution',
  },
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'Bob Highconfidence Match',
    mismatchReason: TrusteeAppointmentSyncErrorCode.HighConfidenceMatch,
    status: 'pending',
    candidateCount: 1,
    note: 'High-confidence but not perfect match — pending manual resolution',
  },
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'Carol Resolved Case',
    mismatchReason: TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
    status: 'approved',
    candidateCount: 0,
    note: 'Already resolved (approved) — upsertMatchVerification should skip this doc',
  },
  {
    caseId: MockData.randomCaseId('TST'),
    dxtrFullName: 'David Dismissed Case',
    mismatchReason: TrusteeAppointmentSyncErrorCode.ImperfectMatch,
    status: 'rejected',
    candidateCount: 1,
    note: 'Dismissed (rejected) — upsertMatchVerification should skip this doc',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

function buildCandidates(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    trusteeId: `seed-candidate-${i + 1}`,
    trusteeName: `Seed Candidate ${i + 1}`,
    totalScore: 60 + i * 10,
    addressScore: 20,
    districtDivisionScore: 20,
    chapterScore: 20,
  }));
}

function buildVerificationDoc(seed: VerificationSeed): TrusteeMatchVerification {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
    caseId: seed.caseId,
    courtId: SEED_COURT_ID,
    dxtrTrustee: { fullName: seed.dxtrFullName },
    mismatchReason: seed.mismatchReason,
    matchCandidates: buildCandidates(seed.candidateCount),
    orderType: 'trustee-match',
    status: seed.status,
    createdOn: now,
    createdBy: SEED_SYSTEM_USER,
    updatedOn: now,
    updatedBy: SEED_SYSTEM_USER,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function seedProIds() {
  console.log('\nSeeding trustees WITH professional IDs...');
  const context = await getContext();
  const trusteesRepo = factory.getTrusteesRepository(context);
  const proIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);

  for (const def of TRUSTEES_WITH_PROID) {
    const trustee = await trusteesRepo.createTrustee(makeTrusteeInput(def.name, def.state), SEED_SYSTEM_USER);
    await proIdsRepo.createProfessionalId(trustee.trusteeId, def.proId, SEED_SYSTEM_USER);
    console.log(`  Created: ${def.name}`);
    console.log(`    trusteeId : ${trustee.trusteeId}`);
    console.log(`    proId     : ${def.proId}`);
  }

  console.log('\nSeeding trustees WITHOUT professional IDs...');
  for (const def of TRUSTEES_WITHOUT_PROID) {
    const trustee = await trusteesRepo.createTrustee(makeTrusteeInput(def.name, def.state), SEED_SYSTEM_USER);
    console.log(`  Created: ${def.name}`);
    console.log(`    trusteeId : ${trustee.trusteeId}`);
    console.log(`    proId     : (none)`);
  }

  console.log('\nDone. Run "list" to verify.');
}

async function seedMatchVerifications() {
  console.log('\nSeeding TrusteeMatchVerification documents...');
  const context = await getContext();
  const verificationRepo = factory.getTrusteeMatchVerificationRepository(context);

  for (const seed of VERIFICATION_SEEDS) {
    const doc = buildVerificationDoc(seed);
    await verificationRepo.upsertVerification(doc);
    const statusLabel = seed.status === 'pending' ? 'pending (actionable)' : `${seed.status} (will be skipped by upsertMatchVerification)`;
    console.log(`  ${seed.caseId}`);
    console.log(`    mismatchReason : ${seed.mismatchReason}`);
    console.log(`    status         : ${statusLabel}`);
    console.log(`    note           : ${seed.note}`);
  }

  console.log('\nDone. Run "list" to verify.');
}

async function listSeededData() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in .env');
    return;
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);

    // Seeded trustees
    const trustees = await db
      .collection('trustees')
      .find({ name: { $regex: `^${SEED_NAME_PREFIX}` } })
      .project({ trusteeId: 1, name: 1, _id: 0 })
      .toArray();

    console.log(`\nSeeded trustees (${trustees.length}):`);
    for (const t of trustees) {
      console.log(`  ${t.name} — trusteeId: ${t.trusteeId}`);
    }

    // Seeded professional IDs
    const trusteeIds = trustees.map((t) => t.trusteeId).filter(Boolean);
    const proIds = trusteeIds.length
      ? await db
          .collection('trustee-professional-ids')
          .find({ camsTrusteeId: { $in: trusteeIds } })
          .project({ camsTrusteeId: 1, acmsProfessionalId: 1, _id: 0 })
          .toArray()
      : [];

    console.log(`\nSeeded professional IDs (${proIds.length}):`);
    for (const p of proIds) {
      const trustee = trustees.find((t) => t.trusteeId === p.camsTrusteeId);
      console.log(`  ${trustee?.name ?? p.camsTrusteeId} → ${p.acmsProfessionalId}`);
    }
    const withoutProId = trustees.filter((t) => !proIds.some((p) => p.camsTrusteeId === t.trusteeId));
    for (const t of withoutProId) {
      console.log(`  ${t.name} → (no proId)`);
    }

    // Seeded verifications
    const verifications = await db
      .collection('trustee-match-verification')
      .find({ caseId: { $regex: `^${SEED_CASE_PREFIX}` } })
      .project({ caseId: 1, mismatchReason: 1, status: 1, _id: 0 })
      .toArray();

    console.log(`\nSeeded TrusteeMatchVerification docs (${verifications.length}):`);
    for (const v of verifications) {
      console.log(`  ${v.caseId} — ${v.mismatchReason} / ${v.status}`);
    }
  } finally {
    await client.close();
  }
}

async function cleanSeededData() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in .env');
    return;
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);

    // Find seeded trustee IDs before deleting trustees (needed for proId cleanup)
    const seededTrustees = await db
      .collection('trustees')
      .find({ name: { $regex: `^${SEED_NAME_PREFIX}` } })
      .project({ trusteeId: 1, _id: 0 })
      .toArray();
    const seededTrusteeIds = seededTrustees.map((t) => t.trusteeId).filter(Boolean);

    // Delete professional IDs for seeded trustees
    const proIdResult = seededTrusteeIds.length
      ? await db
          .collection('trustee-professional-ids')
          .deleteMany({ camsTrusteeId: { $in: seededTrusteeIds } })
      : { deletedCount: 0 };
    console.log(`  Deleted ${proIdResult.deletedCount} professional ID record(s)`);

    // Delete seeded trustees
    const trusteeResult = await db
      .collection('trustees')
      .deleteMany({ name: { $regex: `^${SEED_NAME_PREFIX}` } });
    console.log(`  Deleted ${trusteeResult.deletedCount} trustee record(s)`);

    // Delete seeded verification docs (current TST- prefix and legacy SEED- prefix)
    const verificationResult = await db
      .collection('trustee-match-verification')
      .deleteMany({ caseId: { $regex: `^(${SEED_CASE_PREFIX}|SEED-)` } });
    console.log(`  Deleted ${verificationResult.deletedCount} TrusteeMatchVerification record(s)`);

    console.log('\nClean complete.');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] || 'help';

  console.log('='.repeat(60));
  console.log('CAMS Trustee Test Data Seeder');
  console.log('='.repeat(60));

  switch (command) {
    case 'seed-proid':
      await seedProIds();
      break;

    case 'seed-match-verification':
      await seedMatchVerifications();
      break;

    case 'list':
      await listSeededData();
      break;

    case 'clean':
      console.log('\nCleaning seeded test data...');
      await cleanSeededData();
      break;

    case 'help':
    default:
      console.log(`
Usage: npx tsx --tsconfig backend/tsconfig.json \\
  test/migration/trustee/scripts/seed-test-trustees.ts \\
  [command]

Commands:
  seed-proid               Seed trustees with and without TrusteeProfessionalId records
                           (3 with proIds: NY-SEED-001, CA-SEED-002, TX-SEED-003)
                           (3 without proIds)

  seed-match-verification  Seed TrusteeMatchVerification documents for all slice 3 outcomes:
                             TST-xx-xxxxx  NO_TRUSTEE_MATCH        pending
                             TST-xx-xxxxx  MULTIPLE_TRUSTEES_MATCH pending
                             TST-xx-xxxxx  IMPERFECT_MATCH         pending
                             TST-xx-xxxxx  HIGH_CONFIDENCE_MATCH   pending
                             TST-xx-xxxxx  NO_TRUSTEE_MATCH        approved (skip test)
                             TST-xx-xxxxx  IMPERFECT_MATCH         rejected (skip test)
                           (case IDs are randomly generated on each seed run)

  list                     Show all seeded test data currently in MongoDB

  clean                    Delete all seeded test data (trustees, proIds, verifications)

  help                     Show this message

Examples:
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-proid
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-match-verification
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts list
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean
`);
      break;
  }

  console.log('='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
