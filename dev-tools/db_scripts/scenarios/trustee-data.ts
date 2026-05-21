/**
 * Scenario: trustee-data
 * Database: dxtr + cams
 *
 * Creates the trustee data needed to exercise trustee routes and the
 * trustee match verification workflow:
 *
 *   - One active trustee (SEED Active Trustee) — appears on the trustees list
 *   - One inactive trustee (SEED Inactive Trustee) — appears on the trustees list
 *   - One matched appointment (active trustee, active status, chapter 7)
 *   - One mismatched appointment (active trustee, mismatched status, chapter 13)
 *   - One fresh case (DXTR + Cosmos) to anchor the match verification
 *   - One pending trustee match verification against that case — appears on
 *     the data verification screen
 */

import type { SeedContext, GeneratedCaseId, SeedOperation } from '../../runner.js';
import { buildCaseSummary } from '../lib/scenario-helpers.js';

const ACTIVE_TRUSTEE_ID = 'seed-trustee-active-001';
const INACTIVE_TRUSTEE_ID = 'seed-trustee-inactive-001';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const ids: GeneratedCaseId = await ctx.generateCaseId('081');
  const caseSummary = buildCaseSummary(ids, '7', 'SEED Trustee Verification Case', 'Dave Seedcase');

  return [
    // ── DXTR: case record ────────────────────────────────────────────────────
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [
        {
          CS_CASEID: ids.csCaseId,
          COURT_ID: '0208',
          CS_DIV: '081',
          GRP_DES: 'NY',
          CASE_ID: ids.caseNumber,
          CS_SHORT_TITLE: 'SEED Trustee Verification Case',
          CS_CHAPTER: '7',
          CS_DATE_FILED: '2025-03-01',
          LAST_UPDATE_DATE: '2025-03-01T00:00:00',
        },
      ],
    },

    // ── DXTR: debtor party record ────────────────────────────────────────────
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [
        {
          CS_CASEID: ids.csCaseId,
          COURT_ID: '0208',
          PY_ROLE: 'db',
          PY_LAST_NAME: 'Seedcase',
          PY_FIRST_NAME: 'Dave',
          PY_ADDRESS1: '100 Test Street',
          PY_CITY: 'New York',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
        },
      ],
    },

    // ── Cosmos: synced case document ─────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: ids.caseId,
          documentType: 'SYNCED_CASE',
          ...caseSummary,
          consolidation: [],
          updatedOn: '2025-03-01T00:00:00.000Z',
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
    // Represents a trustee whose CAMS appointment status matches DXTR — no
    // verification action needed.
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
    // Represents a trustee whose CAMS status differs from what DXTR reports —
    // triggers the trustee match verification workflow.
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
    // DXTR reports a trustee named "Samuel Seedtrustee" — slightly different
    // from the Cosmos record "Sam Seedtrustee". The imperfect name match
    // requires a human to confirm the correct trustee before resolving.
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-trustee-match-verification-${ids.caseId}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: ids.caseId,
          courtId: '0208',
          status: 'pending',
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
