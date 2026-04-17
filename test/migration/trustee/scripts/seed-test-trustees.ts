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
 * CAMS-721: Seeds auto-match trustee data by reading real DXTR trustee
 *   appointment events and creating matching CAMS trustees + appointments,
 *   so that running sync-trustee-appointments produces auto-match telemetry
 *   visible in the trustee-matching-analytics workbook.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/migration/trustee/scripts/seed-test-trustees.ts \
 *     [command]
 *
 * Commands:
 *   seed-proid               Create trustees WITH proIds, WITHOUT proIds, and an ambiguous duplicate pair
 *   seed-match-verification  Create TrusteeMatchVerification docs for all slice 3 outcomes
 *   seed-auto-match          Create CAMS trustees + appointments matching real DXTR data
 *   seed-matching-scenarios  Create 24 trustees with appointments covering all matching scenarios
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
import { AppointmentChapterType, AppointmentType, TrusteeInput } from '../../../../common/src/cams/trustees';
import { TrusteeAppointmentInput } from '../../../../common/src/cams/trustee-appointments';
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
// Matching scenario trustees (CAMS-721)
// ---------------------------------------------------------------------------

type MatchingScenarioTrustee = {
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  address: {
    address1: string;
    city: string;
    state: string;
    zipCode: string;
    countryCode: string;
  };
  appointments: Array<{
    courtId: string;
    divisionCode: string;
    chapter: AppointmentChapterType;
    appointmentType: AppointmentType;
    status: 'active' | 'inactive';
  }>;
};

const MATCHING_SCENARIO_TRUSTEES: MatchingScenarioTrustee[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Perfect Auto-Match (5 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test John Doe',
    firstName: 'John',
    middleName: '',
    lastName: 'Doe',
    address: { address1: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0208', divisionCode: '2', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Jane Smith',
    firstName: 'Jane',
    middleName: 'M',
    lastName: 'Smith',
    address: { address1: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001', countryCode: 'US' },
    appointments: [
      { courtId: '0311', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0311', divisionCode: '3', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Robert Johnson',
    firstName: 'Robert',
    middleName: 'L',
    lastName: 'Johnson',
    address: { address1: '789 Pine Rd', city: 'Chicago', state: 'IL', zipCode: '60601', countryCode: 'US' },
    appointments: [
      { courtId: '0867', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0867', divisionCode: '2', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Mary Williams',
    firstName: 'Mary',
    middleName: 'A',
    lastName: 'Williams',
    address: { address1: '321 Elm St', city: 'Houston', state: 'TX', zipCode: '77001', countryCode: 'US' },
    appointments: [
      { courtId: '0209', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0209', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test David Brown',
    firstName: 'David',
    middleName: '',
    lastName: 'Brown',
    address: { address1: '555 Broadway', city: 'Boston', state: 'MA', zipCode: '02101', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0311', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0867', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Multiple Match (4 trustees - 2 duplicate pairs)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test Michael Anderson',
    firstName: 'Michael',
    middleName: 'J',
    lastName: 'Anderson',
    address: { address1: '100 Park Ave', city: 'New York', state: 'NY', zipCode: '10002', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Michael Anderson',
    firstName: 'Michael',
    middleName: 'P',
    lastName: 'Anderson',
    address: { address1: '200 Madison Ave', city: 'New York', state: 'NY', zipCode: '10003', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '2', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Sarah Miller',
    firstName: 'Sarah',
    middleName: '',
    lastName: 'Miller',
    address: { address1: '300 Sunset Blvd', city: 'Los Angeles', state: 'CA', zipCode: '90002', countryCode: 'US' },
    appointments: [
      { courtId: '0311', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Sarah Miller',
    firstName: 'Sarah',
    middleName: 'K',
    lastName: 'Miller',
    address: { address1: '400 Hollywood Blvd', city: 'Los Angeles', state: 'CA', zipCode: '90003', countryCode: 'US' },
    appointments: [
      { courtId: '0311', divisionCode: '2', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Imperfect Match (2 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test Christopher Wilson',
    firstName: 'Christopher',
    middleName: '',
    lastName: 'Wilson',
    address: { address1: '500 Michigan Ave', city: 'Chicago', state: 'IL', zipCode: '60602', countryCode: 'US' },
    appointments: [
      { courtId: '0867', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Elizabeth Martinez',
    firstName: 'Elizabeth',
    middleName: 'A',
    lastName: 'Martinez',
    address: { address1: '600 Main St', city: 'Houston', state: 'TX', zipCode: '77002', countryCode: 'US' },
    appointments: [
      { courtId: '0209', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 4: High Confidence Match (2 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test Thomas Garcia',
    firstName: 'Thomas',
    middleName: 'R',
    lastName: 'Garcia',
    address: { address1: '700 Wall St', city: 'New York', state: 'NY', zipCode: '10004', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0208', divisionCode: '2', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Jennifer Rodriguez',
    firstName: 'Jennifer',
    middleName: 'L',
    lastName: 'Rodriguez',
    address: { address1: '800 Wilshire Blvd', city: 'Los Angeles', state: 'CA', zipCode: '90004', countryCode: 'US' },
    appointments: [
      { courtId: '0311', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Perfect Match but Inactive Status (2 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test James Taylor',
    firstName: 'James',
    middleName: '',
    lastName: 'Taylor',
    address: { address1: '900 State St', city: 'Chicago', state: 'IL', zipCode: '60603', countryCode: 'US' },
    appointments: [
      { courtId: '0867', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'inactive' },
      { courtId: '0867', divisionCode: '2', chapter: '7', appointmentType: 'panel', status: 'inactive' },
    ],
  },
  {
    name: 'SEED Test Linda Moore',
    firstName: 'Linda',
    middleName: 'S',
    lastName: 'Moore',
    address: { address1: '1000 Texas Ave', city: 'Houston', state: 'TX', zipCode: '77003', countryCode: 'US' },
    appointments: [
      { courtId: '0209', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'inactive' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 6: Multi-region trustees (3 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test Patricia Davis',
    firstName: 'Patricia',
    middleName: 'R',
    lastName: 'Davis',
    address: { address1: '888 Market St', city: 'San Francisco', state: 'CA', zipCode: '94102', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0311', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0867', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
    ],
  },
  {
    name: 'SEED Test William Thompson',
    firstName: 'William',
    middleName: 'C',
    lastName: 'Thompson',
    address: { address1: '1100 Atlantic Ave', city: 'Boston', state: 'MA', zipCode: '02102', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0208', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'active' },
      { courtId: '0311', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0311', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Barbara White',
    firstName: 'Barbara',
    middleName: 'J',
    lastName: 'White',
    address: { address1: '1200 Lake Shore Dr', city: 'Chicago', state: 'IL', zipCode: '60604', countryCode: 'US' },
    appointments: [
      { courtId: '0867', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0867', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0867', divisionCode: '1', chapter: '13', appointmentType: 'standing', status: 'active' },
      { courtId: '0209', divisionCode: '1', chapter: '7', appointmentType: 'panel', status: 'active' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Additional coverage (4 trustees)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'SEED Test Charles Harris',
    firstName: 'Charles',
    middleName: 'D',
    lastName: 'Harris',
    address: { address1: '1300 Fifth Ave', city: 'New York', state: 'NY', zipCode: '10005', countryCode: 'US' },
    appointments: [
      { courtId: '0208', divisionCode: '3', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0208', divisionCode: '3', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Nancy Clark',
    firstName: 'Nancy',
    middleName: 'B',
    lastName: 'Clark',
    address: { address1: '1400 Beach Blvd', city: 'Los Angeles', state: 'CA', zipCode: '90005', countryCode: 'US' },
    appointments: [
      { courtId: '0311', divisionCode: '2', chapter: '7', appointmentType: 'panel', status: 'active' },
      { courtId: '0311', divisionCode: '3', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Daniel Lee',
    firstName: 'Daniel',
    middleName: 'F',
    lastName: 'Lee',
    address: { address1: '1500 Lakeview Ave', city: 'Chicago', state: 'IL', zipCode: '60605', countryCode: 'US' },
    appointments: [
      { courtId: '0867', divisionCode: '2', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0867', divisionCode: '3', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
  {
    name: 'SEED Test Susan Lewis',
    firstName: 'Susan',
    middleName: 'M',
    lastName: 'Lewis',
    address: { address1: '1600 Houston St', city: 'Houston', state: 'TX', zipCode: '77004', countryCode: 'US' },
    appointments: [
      { courtId: '0209', divisionCode: '1', chapter: '11', appointmentType: 'case-by-case', status: 'active' },
      { courtId: '0209', divisionCode: '2', chapter: '13', appointmentType: 'standing', status: 'active' },
    ],
  },
];

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
// Auto-match helpers
// ---------------------------------------------------------------------------

/**
 * Maps a raw DXTR chapter string (e.g. '07', '11') to an AppointmentChapterType.
 * Returns undefined for unsupported chapters.
 */
function toAppointmentChapterType(rawChapter: string): AppointmentChapterType | undefined {
  const normalized = rawChapter.replace(/^0+/, '');
  const supported: AppointmentChapterType[] = ['7', '11', '12', '13'];
  return supported.includes(normalized as AppointmentChapterType)
    ? (normalized as AppointmentChapterType)
    : undefined;
}

/**
 * Returns the default AppointmentType for a given chapter.
 * Uses the most common type that supports 'active' status.
 */
function defaultAppointmentType(chapter: AppointmentChapterType): AppointmentType {
  const map: Record<AppointmentChapterType, AppointmentType> = {
    '7': 'panel',
    '11': 'case-by-case',
    '11-subchapter-v': 'pool',
    '12': 'standing',
    '13': 'standing',
  };
  return map[chapter];
}

/**
 * Parses the first word of a "City, ST zip" string as the city, state, and zip.
 * Returns fallback values if parsing fails.
 */
function parseAddressFromLegacy(cityStateZipCountry?: string): {
  city: string;
  state: string;
  zipCode: string;
} {
  if (cityStateZipCountry) {
    const match = cityStateZipCountry.match(/^(.+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i);
    if (match) {
      return { city: match[1].trim(), state: match[2].trim(), zipCode: match[3].trim() };
    }
  }
  return { city: 'Test City', state: 'NY', zipCode: '10001' };
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

/**
 * Seed trustees with appointments to test all matching scenarios (CAMS-721).
 *
 * Creates 24 trustees with various appointment configurations covering:
 *  - Perfect auto-match (5 trustees)
 *  - Multiple match/ambiguous (2 duplicate pairs = 4 trustees)
 *  - Imperfect match/low confidence (2 trustees)
 *  - High confidence match (2 trustees)
 *  - Perfect match but inactive status (2 trustees)
 *  - Multi-region coverage (3 trustees)
 *  - Additional court/chapter coverage (4 trustees)
 *
 * All trustees use the "SEED Test" prefix for easy identification and cleanup.
 */
async function seedMatchingScenarios() {
  console.log('\nSeeding matching scenario trustees with appointments...');
  const context = await getContext();
  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  let successCount = 0;
  let appointmentCount = 0;

  for (const seed of MATCHING_SCENARIO_TRUSTEES) {
    // Create trustee
    const trusteeInput: TrusteeInput = {
      name: seed.name,
      public: {
        address: {
          ...seed.address,
          countryCode: seed.address.countryCode as 'US',
        },
      },
    };

    const trustee = await trusteesRepo.createTrustee(trusteeInput, SEED_SYSTEM_USER);

    // Create appointments
    for (const appt of seed.appointments) {
      const appointmentInput: TrusteeAppointmentInput = {
        chapter: appt.chapter,
        appointmentType: appt.appointmentType,
        courtId: appt.courtId,
        divisionCode: appt.divisionCode,
        appointedDate: '2020-01-01',
        status: appt.status,
        effectiveDate: '2020-01-01',
      };
      await appointmentsRepo.createAppointment(trustee.trusteeId, appointmentInput, SEED_SYSTEM_USER);
      appointmentCount++;
    }

    console.log(`  Created: ${seed.name}`);
    console.log(`    trusteeId  : ${trustee.trusteeId}`);
    console.log(`    appointments: ${seed.appointments.map(a => `${a.courtId}/${a.divisionCode} Ch${a.chapter} (${a.status})`).join(', ')}`);

    successCount++;
    await sleep(150); // avoid Cosmos RU throttle
  }

  console.log(`\nCreated ${successCount} trustees with ${appointmentCount} appointments.`);
  console.log('\nScenario coverage:');
  console.log('  ✓ Perfect auto-match (5 trustees)');
  console.log('  ✓ Multiple match (2 duplicate pairs = 4 trustees)');
  console.log('  ✓ Imperfect match (2 trustees)');
  console.log('  ✓ High confidence match (2 trustees)');
  console.log('  ✓ Perfect match but inactive (2 trustees)');
  console.log('  ✓ Multi-region coverage (3 trustees)');
  console.log('  ✓ Additional coverage (4 trustees)');
  console.log('\nDone. Run "list" to verify.');
}

/**
 * Seed auto-match trustee data by reading real DXTR trustee appointment events.
 *
 * For each DXTR event where the synced case already exists in Cosmos:
 *  1. Creates a CAMS trustee with the same name as the DXTR trustee.
 *  2. Creates a TrusteeAppointment with status='active' matching the case's
 *     courtId, courtDivisionCode, and chapter — satisfying isPerfectMatch().
 *  3. Creates a CaseAppointment linking the case to the trustee, simulating
 *     the result that sync-trustee-appointments would produce.
 *
 * After running this, trigger the sync-trustee-appointments dataflow to generate
 * auto-match telemetry visible in the trustee-matching-analytics workbook.
 */
async function seedAutoMatches(maxCount = 5) {
  console.log(`\nSeeding auto-match trustee data (up to ${maxCount} cases)...`);

  const context = await getContext();
  const casesGateway = factory.getCasesGateway(context);
  const casesRepo = factory.getCasesRepository(context);
  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const syncStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);

  // Read the same lastSyncDate the dataflow will use so we only set up data
  // for events the next sync run will actually process.
  let lastSyncDate = '2018-01-01';
  try {
    const syncState = await syncStateRepo.read('TRUSTEE_APPOINTMENTS_SYNC_STATE');
    lastSyncDate = syncState.lastSyncDate;
    console.log(`  Sync state found — lastSyncDate: ${lastSyncDate}`);
  } catch {
    console.log('  No sync state found — using default start date: 2018-01-01');
  }

  console.log(`  Querying DXTR for trustee appointment events since ${lastSyncDate}...`);
  const { events } = await casesGateway.getTrusteeAppointments(context, lastSyncDate);
  console.log(`  Found ${events.length} DXTR events since ${lastSyncDate}\n`);

  if (events.length === 0) {
    console.log('  No DXTR events found for the current sync window.');
    console.log('  The sync may already be caught up. Options:');
    console.log('    1. Delete the sync state to reprocess all history:');
    console.log('         db.runtime-state.deleteOne({ documentType: "TRUSTEE_APPOINTMENTS_SYNC_STATE" })');
    console.log('    2. Wait for new trustee appointment transactions in DXTR.');
    return;
  }

  let successCount = 0;
  let skippedNoCase = 0;
  let skippedBadChapter = 0;

  for (const event of events) {
    if (successCount >= maxCount) break;

    // Resolve the synced case — skip if not yet in Cosmos
    let syncedCase;
    try {
      syncedCase = await casesRepo.getSyncedCase(event.caseId);
    } catch {
      skippedNoCase++;
      continue;
    }

    if (!syncedCase.courtId || !syncedCase.courtDivisionCode || !syncedCase.chapter) {
      skippedNoCase++;
      continue;
    }

    // Map DXTR chapter string to AppointmentChapterType
    const chapter = toAppointmentChapterType(syncedCase.chapter);
    if (!chapter) {
      skippedBadChapter++;
      continue;
    }
    const appointmentType = defaultAppointmentType(chapter);

    // Build address from DXTR legacy data
    const { city, state, zipCode } = parseAddressFromLegacy(event.dxtrTrustee.legacy?.cityStateZipCountry);

    // Guard: if a CAMS trustee with this exact name already exists, skip creation.
    // Without this check, running seed-auto-match more than once (or when the same
    // trustee name appears in multiple DXTR events) creates duplicates. Duplicates
    // cause matchTrusteeByName to throw MULTIPLE_TRUSTEES_MATCH, which routes through
    // fuzzy matching to HIGH_CONFIDENCE instead of AUTO_MATCH.
    const existing = await trusteesRepo.searchTrusteesByName(event.dxtrTrustee.fullName);
    if (existing.length > 0) {
      console.log(`  [skip] "${event.dxtrTrustee.fullName}" already has ${existing.length} CAMS record(s) — skipping to avoid duplicate`);
      continue;
    }

    const trusteeInput: TrusteeInput = {
      name: event.dxtrTrustee.fullName,
      public: {
        address: {
          address1: event.dxtrTrustee.legacy?.address1 || '123 DXTR Street',
          city,
          state,
          zipCode,
          countryCode: 'US',
        },
        ...(event.dxtrTrustee.legacy?.email ? { email: event.dxtrTrustee.legacy.email } : {}),
      },
    };

    const trustee = await trusteesRepo.createTrustee(trusteeInput, SEED_SYSTEM_USER);

    const appointmentInput: TrusteeAppointmentInput = {
      chapter,
      appointmentType,
      courtId: syncedCase.courtId,
      divisionCode: syncedCase.courtDivisionCode,
      appointedDate: '2020-01-01',
      status: 'active',
      effectiveDate: '2020-01-01',
    };
    await appointmentsRepo.createAppointment(trustee.trusteeId, appointmentInput, SEED_SYSTEM_USER);

    await appointmentsRepo.createCaseAppointment({
      caseId: event.caseId,
      trusteeId: trustee.trusteeId,
      assignedOn: new Date().toISOString(),
    });

    console.log(`  [${successCount + 1}] ${event.caseId}`);
    console.log(`        DXTR name  : ${event.dxtrTrustee.fullName}`);
    console.log(`        trusteeId  : ${trustee.trusteeId}`);
    console.log(`        courtId    : ${syncedCase.courtId}  divisionCode: ${syncedCase.courtDivisionCode}  chapter: ${chapter}`);
    successCount++;

    await sleep(150); // avoid Cosmos RU throttle
  }

  console.log(`\nCreated ${successCount} auto-match setup(s).`);
  if (skippedNoCase > 0) console.log(`  Skipped ${skippedNoCase} events (case not in Cosmos or missing fields).`);
  if (skippedBadChapter > 0) console.log(`  Skipped ${skippedBadChapter} events (unsupported chapter).`);
  console.log('\nNext step: trigger the sync-trustee-appointments dataflow to generate auto-match telemetry.');
  console.log('Run "list" to verify seeded data.');
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

    // All seeded trustees (by createdBy.id, covers both prefixed and auto-match trustees)
    const trustees = await db
      .collection('trustees')
      .find({ 'createdBy.id': 'SEED-SCRIPT' })
      .project({ trusteeId: 1, name: 1, _id: 0 })
      .toArray();

    // Detect duplicates — more than one record per name causes MULTIPLE_TRUSTEES_MATCH
    // in the sync, routing to high-confidence instead of auto-match.
    const nameCounts = trustees.reduce<Record<string, number>>((acc, t) => {
      acc[t.name] = (acc[t.name] ?? 0) + 1;
      return acc;
    }, {});
    const hasDuplicates = Object.values(nameCounts).some((n) => n > 1);

    console.log(`\nSeeded trustees (${trustees.length}):`);
    for (const t of trustees) {
      const count = nameCounts[t.name];
      const warn = count > 1 ? ` ⚠️  DUPLICATE (${count} records — will cause HIGH_CONFIDENCE instead of AUTO_MATCH)` : '';
      console.log(`  ${t.name} — trusteeId: ${t.trusteeId}${warn}`);
    }
    if (hasDuplicates) {
      console.log('\n  ⚠️  Duplicates detected. Run "clean" then "seed-auto-match" again to fix.');
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delete all documents from a collection one at a time to avoid Cosmos DB RU throttle (error 16500).
 * Retries individual deletes with exponential backoff when throttled.
 */
async function deleteManyInBatches(
  db: ReturnType<MongoClient['db']>,
  collectionName: string,
  filter: Record<string, unknown> = {},
  delayMs = 100,
): Promise<number> {
  const collection = db.collection(collectionName);
  let totalDeleted = 0;

  while (true) {
    const doc = await collection.findOne(filter, { projection: { _id: 1 } });
    if (!doc) break;

    let retryDelay = 500;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await collection.deleteOne({ _id: doc._id });
        totalDeleted++;
        break;
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? (err as { code: number }).code
            : 0;
        if (code === 16500 && attempt < 5) {
          await sleep(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 10000);
        } else {
          throw err;
        }
      }
    }

    await sleep(delayMs);
  }

  return totalDeleted;
}

async function cleanAllTrusteeData() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in .env');
    return;
  }

  console.log(`  Database: ${dbName}`);
  console.log('  WARNING: This deletes ALL trustee data regardless of origin.\n');

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);

    const collections = [
      'trustees',
      'trustee-appointments',
      'trustee-professional-ids',
      'trustee-match-verification',
    ];

    for (const name of collections) {
      process.stdout.write(`  Deleting ${name}...`);
      const count = await deleteManyInBatches(db, name);
      console.log(` ${count} document(s) deleted`);
    }

    const stateTypes = [
      'TRUSTEE_MIGRATION_STATE',
      'TRUSTEE_APPOINTMENTS_SYNC_STATE',
      'PHONETIC_BACKFILL_STATE',
    ];
    const stateResult = await db
      .collection('runtime-state')
      .deleteMany({ documentType: { $in: stateTypes } });
    console.log(`  Deleted ${stateResult.deletedCount} runtime-state document(s) (${stateTypes.join(', ')})`);

    console.log('\nClean complete.');
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

    // Find ALL seeded trustee IDs — covers both SEED Test prefix and auto-match trustees
    // (auto-match trustees use real DXTR names but are identified by createdBy.id)
    const seededTrustees = await db
      .collection('trustees')
      .find({ 'createdBy.id': 'SEED-SCRIPT' })
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

    // Delete trustee and case appointments for seeded trustees (auto-match seeds create these).
    // Both TRUSTEE_APPOINTMENT and CASE_APPOINTMENT documents live in the same collection.
    const apptResult = seededTrusteeIds.length
      ? await db
          .collection('trustee-appointments')
          .deleteMany({ trusteeId: { $in: seededTrusteeIds } })
      : { deletedCount: 0 };
    console.log(`  Deleted ${apptResult.deletedCount} trustee/case-appointment record(s)`);

    // Delete seeded trustees (all created by SEED-SCRIPT)
    const trusteeResult = seededTrusteeIds.length
      ? await db
          .collection('trustees')
          .deleteMany({ 'createdBy.id': 'SEED-SCRIPT' })
      : { deletedCount: 0 };
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

    case 'seed-auto-match': {
      const count = parseInt(process.argv[3] || '5', 10);
      await seedAutoMatches(count);
      break;
    }

    case 'seed-matching-scenarios':
      await seedMatchingScenarios();
      break;

    case 'list':
      await listSeededData();
      break;

    case 'clean':
      console.log('\nCleaning seeded test data...');
      await cleanSeededData();
      break;

    case 'clean-all':
      console.log('\nCleaning ALL trustee data (trustees, appointments, proIds, verifications, migration state)...');
      await cleanAllTrusteeData();
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

  seed-auto-match [N]      Read real DXTR trustee appointment events and create matching
                           CAMS trustees + appointments so that sync-trustee-appointments
                           will auto-match them, generating telemetry for the workbook.
                           Optional N = number of cases to set up (default: 5).
                           Requires DXTR connection and synced cases already in Cosmos.
                           After seeding, trigger the sync-trustee-appointments dataflow.

  seed-matching-scenarios  Seed 24 trustees with appointments covering all matching scenarios:
                             • Perfect auto-match (5 trustees)
                             • Multiple match/ambiguous (2 duplicate pairs = 4 trustees)
                             • Imperfect match/low confidence (2 trustees)
                             • High confidence match (2 trustees)
                             • Perfect match but inactive status (2 trustees)
                             • Multi-region coverage (3 trustees)
                             • Additional court/chapter coverage (4 trustees)
                           All trustees use "SEED Test" prefix for easy cleanup.
                           Courts: 0208, 0311, 0867, 0209 with multiple divisions/chapters.

  list                     Show all seeded test data currently in MongoDB

  clean                    Delete only seeded test data (all trustees created by SEED-SCRIPT, their
                           appointments, proIds, and TST-/SEED- verification docs)

  clean-all                Delete ALL trustee data from every trustee collection regardless of origin:
                             trustees, trustee-appointments, trustee-professional-ids,
                             trustee-match-verification, and trustee-related runtime-state entries.
                           Use this to fully reset the dev Cosmos DB when stale migration data
                           has accumulated.

  help                     Show this message

Examples:
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-proid
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-match-verification
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-auto-match
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-auto-match 10
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-matching-scenarios
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts list
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean-all
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
