/**
 * Scenario: trustee-match-all-scenarios
 * Database: cams only
 *
 * Seeds comprehensive trustee match verification data to exercise all match types:
 *
 *   - All 5 match verification types:
 *     1. NO_TRUSTEE_MATCH - No candidates found
 *     2. MULTIPLE_TRUSTEES_MATCH - Multiple equally-scored candidates
 *     3. IMPERFECT_MATCH - Single candidate with low confidence score
 *     4. HIGH_CONFIDENCE_MATCH - Single candidate with high confidence score
 *     5. PERFECT_MATCH_INACTIVE_STATUS - Perfect match but trustee/appointment inactive
 *
 *   - 7 inactive status variations for PERFECT_MATCH_INACTIVE_STATUS:
 *     - Inactive trustee + active appointment
 *     - Active trustee + inactive appointment
 *     - Inactive trustee + inactive appointment
 *     - Inactive trustee + terminated appointment
 *     - Inactive trustee + resigned appointment
 *     - Inactive trustee + removed appointment
 *     - Inactive trustee + deceased appointment
 *
 * NOTE: Uses existing DXTR cases - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Existing DXTR cases in Manhattan (081)
const CASE_NO_MATCH = '081-26-91522'; // Ch7
const CASE_MULTIPLE_MATCH = '091-99-00874'; // Ch11
const CASE_IMPERFECT_MATCH = '081-26-92693'; // Ch13
const CASE_HIGH_CONFIDENCE = '081-26-91522'; // Ch7 (reuse)
const CASE_INACTIVE_TRUSTEE = '091-99-00874'; // Ch11 (reuse)
const CASE_INACTIVE_APPOINTMENT = '081-26-92693'; // Ch13 (reuse)
const CASE_BOTH_INACTIVE = '081-26-91522'; // Ch7 (reuse)
const CASE_TERMINATED = '091-99-00874'; // Ch11 (reuse)
const CASE_RESIGNED = '081-26-92693'; // Ch13 (reuse)
const CASE_REMOVED = '081-26-91522'; // Ch7 (reuse)
const CASE_DECEASED = '091-99-00874'; // Ch11 (reuse)

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: Trustees for match scenarios ─────────────────────────────────

    // Active trustee for multiple matches
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-match-multi-a',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-match-multi-a',
          name: 'Taylor Multimatch',
          firstName: 'Taylor',
          lastName: 'Multimatch',
          status: 'active',
          public: {
            address: {
              address1: '300 Match Ave',
              city: 'New York',
              state: 'NY',
              zipCode: '10003',
              countryCode: 'US',
            },
            phone: { number: '212-555-3000' },
            email: 'taylor.multimatch@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Second active trustee for multiple matches
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-match-multi-b',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-match-multi-b',
          name: 'Tyler Multimatch',
          firstName: 'Tyler',
          lastName: 'Multimatch',
          status: 'active',
          public: {
            address: {
              address1: '301 Match Ave',
              city: 'New York',
              state: 'NY',
              zipCode: '10003',
              countryCode: 'US',
            },
            phone: { number: '212-555-3001' },
            email: 'tyler.multimatch@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Active trustee for imperfect match
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-match-imperfect',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-match-imperfect',
          name: 'Jordan Imperfectmatch',
          firstName: 'Jordan',
          lastName: 'Imperfectmatch',
          status: 'active',
          public: {
            address: {
              address1: '400 Match Blvd',
              city: 'New York',
              state: 'NY',
              zipCode: '10004',
              countryCode: 'US',
            },
            phone: { number: '212-555-4000' },
            email: 'jordan.imperfectmatch@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Active trustee for high confidence match
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-match-highconf',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-match-highconf',
          name: 'Alex Highconfidence',
          firstName: 'Alex',
          lastName: 'Highconfidence',
          status: 'active',
          public: {
            address: {
              address1: '500 Match St',
              city: 'New York',
              state: 'NY',
              zipCode: '10005',
              countryCode: 'US',
            },
            phone: { number: '212-555-5000' },
            email: 'alex.highconfidence@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Inactive trustee for status scenarios
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-trustee-match-inactive',
          documentType: 'TRUSTEE',
          trusteeId: 'seed-trustee-match-inactive',
          name: 'Morgan Inactivematch',
          firstName: 'Morgan',
          lastName: 'Inactivematch',
          status: 'inactive',
          public: {
            address: {
              address1: '600 Match Dr',
              city: 'New York',
              state: 'NY',
              zipCode: '10006',
              countryCode: 'US',
            },
            phone: { number: '212-555-6000' },
            email: 'morgan.inactivematch@example.com',
          },
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Appointments for status scenarios ────────────────────────────

    // Active appointment for inactive trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-inactive-trustee-active-appt',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-inactive',
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

    // Inactive appointment for high-confidence trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-active-trustee-inactive-appt',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-highconf',
          chapter: '11',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['091'],
          appointedDate: '2020-01-01',
          status: 'inactive',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Terminated appointment for inactive trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-terminated',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-inactive',
          chapter: '11',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['091'],
          appointedDate: '2019-01-01',
          status: 'terminated',
          effectiveDate: '2019-01-01',
          endDate: '2024-12-31',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Resigned appointment for inactive trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-resigned',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-inactive',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2018-01-01',
          status: 'resigned',
          effectiveDate: '2018-01-01',
          endDate: '2023-06-30',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Removed appointment for inactive trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-removed',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-inactive',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2017-01-01',
          status: 'removed',
          effectiveDate: '2017-01-01',
          endDate: '2022-03-15',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // Deceased appointment for inactive trustee
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-deceased',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-match-inactive',
          chapter: '11',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['091'],
          appointedDate: '2016-01-01',
          status: 'deceased',
          effectiveDate: '2016-01-01',
          endDate: '2021-09-20',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 1 - NO_TRUSTEE_MATCH ─────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-no-match-${CASE_NO_MATCH}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_NO_MATCH,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'NO_TRUSTEE_MATCH',
          dxtrTrustee: {
            firstName: 'Unique',
            lastName: 'Nomatch',
            fullName: 'Unique Nomatch',
          },
          matchCandidates: [],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 2 - MULTIPLE_TRUSTEES_MATCH ──────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-multiple-${CASE_MULTIPLE_MATCH}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_MULTIPLE_MATCH,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
          dxtrTrustee: {
            firstName: 'T',
            lastName: 'Multimatch',
            fullName: 'T Multimatch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-multi-a',
              trusteeName: 'Taylor Multimatch',
              totalScore: 90,
              addressScore: 90,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '300 Match Ave',
                city: 'New York',
                state: 'NY',
                zipCode: '10003',
                countryCode: 'US',
              },
              phone: { number: '212-555-3000' },
              email: 'taylor.multimatch@example.com',
            },
            {
              trusteeId: 'seed-trustee-match-multi-b',
              trusteeName: 'Tyler Multimatch',
              totalScore: 90,
              addressScore: 90,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '301 Match Ave',
                city: 'New York',
                state: 'NY',
                zipCode: '10003',
                countryCode: 'US',
              },
              phone: { number: '212-555-3001' },
              email: 'tyler.multimatch@example.com',
            },
          ],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 3 - IMPERFECT_MATCH ──────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-imperfect-${CASE_IMPERFECT_MATCH}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_IMPERFECT_MATCH,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'IMPERFECT_MATCH',
          dxtrTrustee: {
            firstName: 'J',
            lastName: 'Imperfectmatch',
            fullName: 'J Imperfectmatch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-imperfect',
              trusteeName: 'Jordan Imperfectmatch',
              totalScore: 65,
              addressScore: 70,
              districtDivisionScore: 80,
              chapterScore: 100,
              address: {
                address1: '400 Match Blvd',
                city: 'New York',
                state: 'NY',
                zipCode: '10004',
                countryCode: 'US',
              },
              phone: { number: '212-555-4000' },
              email: 'jordan.imperfectmatch@example.com',
            },
          ],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 4 - HIGH_CONFIDENCE_MATCH ────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-highconf-${CASE_HIGH_CONFIDENCE}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_HIGH_CONFIDENCE,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'HIGH_CONFIDENCE_MATCH',
          dxtrTrustee: {
            firstName: 'Alex',
            lastName: 'Highconfidence',
            fullName: 'Alex Highconfidence',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-highconf',
              trusteeName: 'Alex Highconfidence',
              totalScore: 95,
              addressScore: 95,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '500 Match St',
                city: 'New York',
                state: 'NY',
                zipCode: '10005',
                countryCode: 'US',
              },
              phone: { number: '212-555-5000' },
              email: 'alex.highconfidence@example.com',
            },
          ],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 5 - Status Variations ─────────────────

    // 5a: Inactive trustee + active appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-inactive-trustee-${CASE_INACTIVE_TRUSTEE}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_INACTIVE_TRUSTEE,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Morgan',
            lastName: 'Inactivematch',
            fullName: 'Morgan Inactivematch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-inactive',
              trusteeName: 'Morgan Inactivematch',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '600 Match Dr',
                city: 'New York',
                state: 'NY',
                zipCode: '10006',
                countryCode: 'US',
              },
              phone: { number: '212-555-6000' },
              email: 'morgan.inactivematch@example.com',
            },
          ],
          inactiveAppointmentStatus: 'active',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5b: Active trustee + inactive appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-inactive-appt-${CASE_INACTIVE_APPOINTMENT}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_INACTIVE_APPOINTMENT,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Alex',
            lastName: 'Highconfidence',
            fullName: 'Alex Highconfidence',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-highconf',
              trusteeName: 'Alex Highconfidence',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '500 Match St',
                city: 'New York',
                state: 'NY',
                zipCode: '10005',
                countryCode: 'US',
              },
              phone: { number: '212-555-5000' },
              email: 'alex.highconfidence@example.com',
            },
          ],
          inactiveAppointmentStatus: 'inactive',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5c: Inactive trustee + terminated appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-terminated-${CASE_TERMINATED}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_TERMINATED,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Morgan',
            lastName: 'Inactivematch',
            fullName: 'Morgan Inactivematch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-inactive',
              trusteeName: 'Morgan Inactivematch',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '600 Match Dr',
                city: 'New York',
                state: 'NY',
                zipCode: '10006',
                countryCode: 'US',
              },
              phone: { number: '212-555-6000' },
              email: 'morgan.inactivematch@example.com',
            },
          ],
          inactiveAppointmentStatus: 'terminated',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5d: Inactive trustee + resigned appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-resigned-${CASE_RESIGNED}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_RESIGNED,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Morgan',
            lastName: 'Inactivematch',
            fullName: 'Morgan Inactivematch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-inactive',
              trusteeName: 'Morgan Inactivematch',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '600 Match Dr',
                city: 'New York',
                state: 'NY',
                zipCode: '10006',
                countryCode: 'US',
              },
              phone: { number: '212-555-6000' },
              email: 'morgan.inactivematch@example.com',
            },
          ],
          inactiveAppointmentStatus: 'resigned',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5e: Inactive trustee + removed appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-removed-${CASE_REMOVED}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_REMOVED,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Morgan',
            lastName: 'Inactivematch',
            fullName: 'Morgan Inactivematch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-inactive',
              trusteeName: 'Morgan Inactivematch',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '600 Match Dr',
                city: 'New York',
                state: 'NY',
                zipCode: '10006',
                countryCode: 'US',
              },
              phone: { number: '212-555-6000' },
              email: 'morgan.inactivematch@example.com',
            },
          ],
          inactiveAppointmentStatus: 'removed',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5f: Inactive trustee + deceased appointment
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-deceased-${CASE_DECEASED}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          orderType: 'trustee-match',
          caseId: CASE_DECEASED,
          courtId: '0208',
          status: 'pending',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          dxtrTrustee: {
            firstName: 'Morgan',
            lastName: 'Inactivematch',
            fullName: 'Morgan Inactivematch',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-inactive',
              trusteeName: 'Morgan Inactivematch',
              totalScore: 100,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '600 Match Dr',
                city: 'New York',
                state: 'NY',
                zipCode: '10006',
                countryCode: 'US',
              },
              phone: { number: '212-555-6000' },
              email: 'morgan.inactivematch@example.com',
            },
          ],
          inactiveAppointmentStatus: 'deceased',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
