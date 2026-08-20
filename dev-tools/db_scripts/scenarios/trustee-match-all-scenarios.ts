/**
 * Scenario: trustee-match-all-scenarios
 * Database: cams only
 *
 * Seeds comprehensive trustee match verification data to exercise all match types:
 *
 *   - All 4 match verification types (a fuzzy-scoring clear winner now auto-links instead of
 *     reaching this collection - see resolveByScoring's 'resolved' case in
 *     sync-trustee-case-appointments.ts - so it has no verification-document scenario to seed
 *     here):
 *     1. NO_TRUSTEE_MATCH - No candidates found
 *     2. AMBIGUOUS_MATCH_UNRESOLVED - Multiple equally-scored candidates (genuine raw-candidate
 *        collision - the UI's "Multiple Match" label and "Other Potential Matches" section)
 *     2b. AMBIGUOUS_MATCH_UNRESOLVED - a SINGLE candidate that scored below the auto-link
 *        threshold (see resolveNameCollisionByScoring/matchTrusteeByName's first-token-lastName
 *        search tier in trustee-match.helpers.ts) - same mismatchReason as #2, but only one raw
 *        candidate ever existed. The UI (TrusteeMatchVerificationAccordion.tsx's isMultipleMatch)
 *        distinguishes this from #2 by candidateCount, showing "Trustee Mismatch" (not "Multiple
 *        Match") and zero "Other Potential Matches" - this scenario exists specifically to
 *        exercise that distinction against real seeded data, not just unit-test mocks.
 *     3. IMPERFECT_MATCH - Single candidate with low confidence score
 *     4. PERFECT_MATCH_INACTIVE_STATUS - Perfect match but trustee/appointment inactive
 *
 *   - 6 inactive status variations for PERFECT_MATCH_INACTIVE_STATUS:
 *     - Inactive trustee + active appointment
 *     - Active trustee + inactive appointment
 *     - Inactive trustee + terminated appointment
 *     - Inactive trustee + resigned appointment
 *     - Inactive trustee + removed appointment
 *     - Inactive trustee + deceased appointment
 *
 * NOTE: Uses existing DXTR cases - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';
import { computeFingerprint } from '../lib/compute-fingerprint.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Existing DXTR cases (Buffalo district)
const CASE_NO_MATCH = '091-99-87899'; // Ch 11 (Kassulke Group)
const CASE_MULTIPLE_MATCH = '091-99-00874'; // Ch 11
const CASE_SINGLE_CANDIDATE_AMBIGUOUS = '091-99-92748'; // Ch 12 (reuse)
const CASE_IMPERFECT_MATCH = '091-99-92748'; // Ch 12 (Botsford LLC)
const CASE_INACTIVE_TRUSTEE = '091-99-00874'; // Ch 11 (reuse)
const CASE_INACTIVE_APPOINTMENT = '091-99-92748'; // Ch 12 (reuse)
const CASE_TERMINATED = '091-99-00874'; // Ch 11 (reuse)
const CASE_RESIGNED = '091-99-92748'; // Ch 12 (reuse)
const CASE_REMOVED = '091-99-87899'; // Ch 11 (reuse)
const CASE_DECEASED = '091-99-00874'; // Ch 11 (reuse)

// DXTR trustee identities shared between `fingerprint` (via computeFingerprint) and
// `dxtrTrustee` below, so the two can never drift out of sync with each other.
const DXTR_NO_MATCH = { firstName: 'Unique', lastName: 'Nomatch', fullName: 'Unique Nomatch' };
const DXTR_MULTIPLE_MATCH = { firstName: 'T', lastName: 'Multimatch', fullName: 'T Multimatch' };
const DXTR_IMPERFECT_MATCH = {
  firstName: 'J',
  lastName: 'Imperfectmatch',
  fullName: 'J Imperfectmatch',
};
const DXTR_HIGH_CONFIDENCE = {
  firstName: 'Alex',
  lastName: 'Highconfidence',
  fullName: 'Alex Highconfidence',
};
const DXTR_INACTIVE_TRUSTEE_ACTIVE_APPT = {
  firstName: 'Morgan',
  middleName: 'A',
  lastName: 'Inactivematch',
  fullName: 'Morgan A Inactivematch',
};
const DXTR_ACTIVE_TRUSTEE_INACTIVE_APPT = {
  firstName: 'Alex',
  middleName: 'Q',
  lastName: 'Highconfidence',
  fullName: 'Alex Q Highconfidence',
};
const DXTR_INACTIVE_TRUSTEE_TERMINATED_APPT = {
  firstName: 'Morgan',
  middleName: 'B',
  lastName: 'Inactivematch',
  fullName: 'Morgan B Inactivematch',
};
const DXTR_INACTIVE_TRUSTEE_RESIGNED_APPT = {
  firstName: 'Morgan',
  middleName: 'C',
  lastName: 'Inactivematch',
  fullName: 'Morgan C Inactivematch',
};
const DXTR_INACTIVE_TRUSTEE_REMOVED_APPT = {
  firstName: 'Morgan',
  middleName: 'D',
  lastName: 'Inactivematch',
  fullName: 'Morgan D Inactivematch',
};
const DXTR_INACTIVE_TRUSTEE_DECEASED_APPT = {
  firstName: 'Morgan',
  middleName: 'E',
  lastName: 'Inactivematch',
  fullName: 'Morgan E Inactivematch',
};

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: Trustees for match scenarios ─────────────────────────────────

    // Active trustee for multiple matches
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-multi-a',
          firstName: 'Taylor',
          lastName: 'Multimatch',
          status: 'active',
          address1: '300 Match Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10003',
          phone: '212-555-3000',
          email: 'taylor.multimatch@example.com',
        }),
      ],
    },

    // Second active trustee for multiple matches
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-multi-b',
          firstName: 'Tyler',
          lastName: 'Multimatch',
          status: 'active',
          address1: '301 Match Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10003',
          phone: '212-555-3001',
          email: 'tyler.multimatch@example.com',
        }),
      ],
    },

    // Active trustee for single-candidate AMBIGUOUS_MATCH_UNRESOLVED (below auto-link threshold)
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-lowconf',
          firstName: 'Sam',
          lastName: 'Lowconfidence',
          status: 'active',
          address1: '350 Match Way',
          city: 'New York',
          state: 'NY',
          zipCode: '10003',
          phone: '212-555-3500',
          email: 'sam.lowconfidence@example.com',
        }),
      ],
    },

    // Active trustee for imperfect match
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-imperfect',
          firstName: 'Jordan',
          lastName: 'Imperfectmatch',
          status: 'active',
          address1: '400 Match Blvd',
          city: 'New York',
          state: 'NY',
          zipCode: '10004',
          phone: '212-555-4000',
          email: 'jordan.imperfectmatch@example.com',
        }),
      ],
    },

    // Active trustee, later given only an inactive appointment (status variation below)
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-highconf',
          firstName: 'Alex',
          lastName: 'Highconfidence',
          status: 'active',
          address1: '500 Match St',
          city: 'New York',
          state: 'NY',
          zipCode: '10005',
          phone: '212-555-5000',
          email: 'alex.highconfidence@example.com',
        }),
      ],
    },

    // Inactive trustee for status scenarios
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        createTrusteeBase({
          id: 'seed-trustee-match-inactive',
          firstName: 'Morgan',
          lastName: 'Inactivematch',
          status: 'inactive',
          address1: '600 Match Dr',
          city: 'New York',
          state: 'NY',
          zipCode: '10006',
          phone: '212-555-6000',
          email: 'morgan.inactivematch@example.com',
        }),
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
          courtId: '0209',
          divisionCodes: ['091'],
          appointedDate: '2020-01-01',
          status: 'inactive',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Western District of New York',
          courtDivisionName: 'Buffalo',
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
          courtId: '0209',
          divisionCodes: ['091'],
          appointedDate: '2019-01-01',
          status: 'terminated',
          effectiveDate: '2019-01-01',
          endDate: '2024-12-31',
          courtName: 'U.S. Bankruptcy Court Western District of New York',
          courtDivisionName: 'Buffalo',
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
          courtId: '0209',
          divisionCodes: ['091'],
          appointedDate: '2016-01-01',
          status: 'deceased',
          effectiveDate: '2016-01-01',
          endDate: '2021-09-20',
          courtName: 'U.S. Bankruptcy Court Western District of New York',
          courtDivisionName: 'Buffalo',
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
          taskType: 'trustee-match',
          caseId: CASE_NO_MATCH,
          courtId: '0208',
          status: 'pending',
          taskDate: '2011-07-08T00:00:00.000Z',
          mismatchReason: 'NO_TRUSTEE_MATCH',
          fingerprint: computeFingerprint(DXTR_NO_MATCH),
          dxtrTrustee: DXTR_NO_MATCH,
          matchCandidates: [],
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Match Verification Type 2 - AMBIGUOUS_MATCH_UNRESOLVED ───────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-multiple-${CASE_MULTIPLE_MATCH}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          taskType: 'trustee-match',
          caseId: CASE_MULTIPLE_MATCH,
          courtId: '0208',
          status: 'pending',
          taskDate: '2015-02-19T00:00:00.000Z',
          mismatchReason: 'AMBIGUOUS_MATCH_UNRESOLVED',
          fingerprint: computeFingerprint(DXTR_MULTIPLE_MATCH),
          dxtrTrustee: DXTR_MULTIPLE_MATCH,
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

    // ── Cosmos: Match Verification Type 2b - AMBIGUOUS_MATCH_UNRESOLVED (single candidate) ──
    // Same mismatchReason as Type 2, but only ONE raw candidate scored below the auto-link
    // threshold - not a genuine 2+ candidate collision. Exercises the UI's candidateCount-based
    // distinction (see TrusteeMatchVerificationAccordion.tsx's isMultipleMatch): this should
    // render as "Trustee Mismatch" with zero "Other Potential Matches", not "Multiple Match".
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-lowconf-${CASE_SINGLE_CANDIDATE_AMBIGUOUS}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          taskType: 'trustee-match',
          caseId: CASE_SINGLE_CANDIDATE_AMBIGUOUS,
          courtId: '0208',
          status: 'pending',
          taskDate: '2016-04-11T00:00:00.000Z',
          mismatchReason: 'AMBIGUOUS_MATCH_UNRESOLVED',
          dxtrTrustee: {
            firstName: 'S',
            lastName: 'Lowconfidence',
            fullName: 'S Lowconfidence',
          },
          matchCandidates: [
            {
              trusteeId: 'seed-trustee-match-lowconf',
              trusteeName: 'Sam Lowconfidence',
              totalScore: 70,
              addressScore: 100,
              districtDivisionScore: 100,
              chapterScore: 100,
              address: {
                address1: '350 Match Way',
                city: 'New York',
                state: 'NY',
                zipCode: '10003',
                countryCode: 'US',
              },
              phone: { number: '212-555-3500' },
              email: 'sam.lowconfidence@example.com',
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
          taskType: 'trustee-match',
          caseId: CASE_IMPERFECT_MATCH,
          courtId: '0208',
          status: 'pending',
          taskDate: '2019-11-30T00:00:00.000Z',
          mismatchReason: 'IMPERFECT_MATCH',
          fingerprint: computeFingerprint(DXTR_IMPERFECT_MATCH),
          dxtrTrustee: DXTR_IMPERFECT_MATCH,
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

    // ── Cosmos: Match Verification Type 4 - Status Variations ─────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-highconf-${CASE_INACTIVE_TRUSTEE}`,
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          taskType: 'trustee-match',
          caseId: CASE_INACTIVE_TRUSTEE,
          courtId: '0208',
          status: 'pending',
          taskDate: '2010-05-12T00:00:00.000Z',
          mismatchReason: 'AMBIGUOUS_MATCH_RESOLVED',
          fingerprint: computeFingerprint(DXTR_HIGH_CONFIDENCE),
          dxtrTrustee: DXTR_HIGH_CONFIDENCE,
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
          taskType: 'trustee-match',
          caseId: CASE_INACTIVE_TRUSTEE,
          courtId: '0208',
          status: 'pending',
          taskDate: '2014-10-25T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_INACTIVE_TRUSTEE_ACTIVE_APPT),
          dxtrTrustee: DXTR_INACTIVE_TRUSTEE_ACTIVE_APPT,
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
          taskType: 'trustee-match',
          caseId: CASE_INACTIVE_APPOINTMENT,
          courtId: '0208',
          status: 'pending',
          taskDate: '2023-04-07T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_ACTIVE_TRUSTEE_INACTIVE_APPT),
          dxtrTrustee: DXTR_ACTIVE_TRUSTEE_INACTIVE_APPT,
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
          taskType: 'trustee-match',
          caseId: CASE_TERMINATED,
          courtId: '0208',
          status: 'pending',
          taskDate: '2013-01-16T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_INACTIVE_TRUSTEE_TERMINATED_APPT),
          dxtrTrustee: DXTR_INACTIVE_TRUSTEE_TERMINATED_APPT,
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
          taskType: 'trustee-match',
          caseId: CASE_RESIGNED,
          courtId: '0208',
          status: 'pending',
          taskDate: '2017-08-22T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_INACTIVE_TRUSTEE_RESIGNED_APPT),
          dxtrTrustee: DXTR_INACTIVE_TRUSTEE_RESIGNED_APPT,
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
          taskType: 'trustee-match',
          caseId: CASE_REMOVED,
          courtId: '0208',
          status: 'pending',
          taskDate: '2016-12-09T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_INACTIVE_TRUSTEE_REMOVED_APPT),
          dxtrTrustee: DXTR_INACTIVE_TRUSTEE_REMOVED_APPT,
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
          taskType: 'trustee-match',
          caseId: CASE_DECEASED,
          courtId: '0208',
          status: 'pending',
          taskDate: '2020-03-28T00:00:00.000Z',
          mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
          fingerprint: computeFingerprint(DXTR_INACTIVE_TRUSTEE_DECEASED_APPT),
          dxtrTrustee: DXTR_INACTIVE_TRUSTEE_DECEASED_APPT,
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
