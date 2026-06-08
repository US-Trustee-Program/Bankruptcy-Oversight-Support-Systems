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
 *   - One pending trustee match verification against case 091-99-87899
 *
 * NOTE: Uses existing DXTR case - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

const ACTIVE_TRUSTEE_ID = 'seed-trustee-active-001';
const INACTIVE_TRUSTEE_ID = 'seed-trustee-inactive-001';

// Existing DXTR case in Buffalo (091)
const CASE_ID = '091-99-87899';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
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
          debtor: {
            name: 'SEED Trustee Verification Case',
            address1: '123 Test St',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Buffalo, NY 14202',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '2026-01-01T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: active trustee ───────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: ACTIVE_TRUSTEE_ID,
          documentType: 'TRUSTEE',
          trusteeId: ACTIVE_TRUSTEE_ID,
          name: 'Sam Seedtrustee',
          firstName: 'Sam',
          lastName: 'Seedtrustee',
          status: 'active',
          public: {
            address: {
              address1: '200 Trustee Ave',
              city: 'New York',
              state: 'NY',
              zipCode: '10002',
              countryCode: 'US',
            },
            phone: { number: '212-555-0200' },
            email: 'sam.seedtrustee@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: inactive trustee ─────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: INACTIVE_TRUSTEE_ID,
          documentType: 'TRUSTEE',
          trusteeId: INACTIVE_TRUSTEE_ID,
          name: 'Pat Seedtrustee',
          firstName: 'Pat',
          lastName: 'Seedtrustee',
          status: 'inactive',
          public: {
            address: {
              address1: '300 Trustee Blvd',
              city: 'New York',
              state: 'NY',
              zipCode: '10003',
              countryCode: 'US',
            },
            phone: { number: '212-555-0300' },
            email: 'pat.seedtrustee@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
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
          id: `seed-trustee-match-verification-${CASE_ID}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          taskType: 'trustee-match',
          caseId: CASE_ID,
          courtId: '0208',
          status: 'pending',
          taskDate: '2025-03-01T00:00:00.000Z',
          mismatchReason: 'IMPERFECT_MATCH',
          dxtrTrustee: {
            firstName: 'Samuel',
            lastName: 'Seedtrustee',
            fullName: 'Samuel Seedtrustee',
          },
          matchCandidates: [
            {
              trusteeId: ACTIVE_TRUSTEE_ID,
              trusteeName: 'Sam Seedtrustee',
              totalScore: 85,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '200 Trustee Ave',
                city: 'New York',
                state: 'NY',
                zipCode: '10002',
                countryCode: 'US',
              },
              phone: { number: '212-555-0200' },
              email: 'sam.seedtrustee@example.com',
            },
          ],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
