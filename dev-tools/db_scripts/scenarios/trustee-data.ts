/**
 * Scenario: trustee-data
 * Database: cams only
 *
 * Seeds trustee data using existing DXTR case 091-99-87899 to exercise
 * trustee routes and the trustee match verification workflow:
 *
 *   - One active trustee (Sam Seedtrustee) — appears on the trustees list
 *   - One inactive trustee (Pat Seedtrustee) — appears on the trustees list
 *   - One matched appointment (active trustee, active status, chapter 7)
 *   - One mismatched appointment (active trustee, mismatched status, chapter 13)
 *   - One pending trustee match verification against case 091-99-16994: Samuel Seedtrustee, an
 *     ambiguous task with both Seedtrustees as candidates (fixture scenario seedTrusteeNickname),
 *     with the surrogate case appointment the sync writes for it. The task has its own case
 *     because 091-99-87899 carries other scenarios' case appointments, and the sync only raises a
 *     task for a case whose trustee it could not resolve.
 *
 * NOTE: Uses existing DXTR case - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';
import { createDebtor } from '../lib/test-data-utils.js';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';
import {
  identityTaskFields,
  scenarioTrusteeDocuments,
} from '../lib/trustee-match-scenario-seeds.js';

const ACTIVE_TRUSTEE_ID = 'seed-trustee-active-001';
const NO_EMAIL_TRUSTEE_ID = 'seed-trustee-nocontact-001';

// Existing DXTR cases in Buffalo (091)
const CASE_ID = '091-99-87899';
const MATCH_VERIFICATION_CASE_ID = '091-99-16994'; // Ch 12

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const matchVerificationTask = identityTaskFields('seedTrusteeNickname');
  const matchVerificationSurrogate = {
    id: `seed-surrogate-trustee-match-verification-${MATCH_VERIFICATION_CASE_ID}`,
    documentType: 'CASE_APPOINTMENT',
    caseId: MATCH_VERIFICATION_CASE_ID,
    trusteeId: matchVerificationTask.fingerprint,
    assignedOn: '2018-01-01T00:00:00.000Z',
    appointedDate: '2018-01-01',
    isSurrogate: true,
    chapter: '12',
    courtDivisionCode: '091',
    createdOn: '2025-03-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  // Ensure case exists in DXTR (guard against accidental deletion)
  const { operations: dxtrOps } = await ensureDxtrCase(ctx, {
    divisionCode: '091',
    chapter: '11',
    debtorName: 'Kassulke Group',
    courtId: '0209',
    groupDesignator: 'BU',
    caseInfo: { caseId: CASE_ID, caseNumber: '99-87899', csCaseId: 'SEED87899' },
  });

  return [
    // ── DXTR operations (if case missing) ────────────────────────────────────
    ...dxtrOps,

    // ── Cosmos: synced case document ─────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: CASE_ID,
          documentType: 'SYNCED_CASE',
          dxtrId: 'SEED87899',
          caseId: CASE_ID,
          caseNumber: '99-87899',
          chapter: '11',
          caseTitle: 'Kassulke Group',
          dateFiled: '1999-01-01',
          officeName: 'Buffalo',
          officeCode: 'USTP_CAMS_Region_2_Office_091',
          courtId: '0209',
          courtName: 'U.S. Bankruptcy Court Western District of New York',
          courtDivisionCode: '091',
          courtDivisionName: 'Buffalo',
          groupDesignator: 'BU',
          regionId: '02',
          regionName: 'NEW YORK',
          consolidation: [],
          debtor: createDebtor('SEED Trustee Verification Case', {
            address1: '123 Test St',
            city: 'Buffalo',
            state: 'NY',
            zip: '14202',
          }),
          updatedOn: '2026-01-01T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: active trustee (Sam) and inactive trustee (Pat) ─────────────
    // The candidates of the identity task below, so they come from its fixture scenario.
    ...scenarioTrusteeDocuments('seedTrusteeNickname').map((trustee) => ({
      db: 'cams' as const,
      collectionOrTable: 'trustees',
      data: [trustee],
    })),

    // ── Cosmos: active trustee missing email (constructed literally, not via  ──
    // createTrusteeBase, since that helper always faker-fills phone/email) ────
    // Exercises TrusteeSearchModal's "Email not provided" placeholder for the
    // selected-trustee side (the court side's missing-contact case is already
    // covered by the pending trustee-match-verification fixture below, which has
    // no DXTR legacy address/phone/email at all).
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: NO_EMAIL_TRUSTEE_ID,
          documentType: 'TRUSTEE',
          trusteeId: NO_EMAIL_TRUSTEE_ID,
          name: 'Nolan Nocontact',
          phoneticTokens: generateSearchTokens('Nolan Nocontact'),
          firstName: 'Nolan',
          lastName: 'Nocontact',
          status: 'active',
          public: {
            address: {
              address1: '400 Trustee Way',
              city: 'New York',
              state: 'NY',
              zipCode: '10004',
              countryCode: 'US',
            },
            phone: { number: '212-555-0400' },
          },
        },
      ],
    },

    // ── Cosmos: matched appointment (active trustee, active status, ch7) ─────
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-matched-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: ACTIVE_TRUSTEE_ID,
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: mismatched appointment (active trustee, chapter 13) ──────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-mismatched-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: ACTIVE_TRUSTEE_ID,
          chapter: '13',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2019-06-01',
          status: 'active',
          effectiveDate: '2019-06-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: pending trustee match verification ───────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-trustee-match-verification-${MATCH_VERIFICATION_CASE_ID}`,
          caseId: MATCH_VERIFICATION_CASE_ID,
          courtId: '0208',
          status: 'pending',
          taskDate: '2025-03-01T00:00:00.000Z',
          ...matchVerificationTask,
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
    // Dual-written to both partitions, as TrusteeCaseAppointmentsMongoRepository does.
    {
      db: 'cams',
      collectionOrTable: 'case-trustee-appointments',
      data: [matchVerificationSurrogate],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-case-appointments',
      data: [matchVerificationSurrogate],
    },
  ];
}
