/**
 * Scenario: trustee-match-all-scenarios
 * Database: cams only
 *
 * Seeds trustee identity tasks (TRUSTEE_MATCH_VERIFICATION documents) the way the DXTR trustee
 * appointment sync writes them: source 'DXTR', the trustee-match pipeline's serialized state as
 * `findings`, and mismatchReason 'ambiguous' (2+ candidates) or 'no match' (0 or 1 candidate).
 * A resolved pipeline match writes the appointment instead, so it has no document to seed here.
 *
 * Each candidate's stored scores are derived by hand from the pipeline's scorer rules
 * (trustee-match-pipeline-stages.ts) against the fixture's own source and CAMS data, and the
 * seed validator (assertTrusteeMatchFindingsValid) rejects any comparison with no data behind it:
 *
 *   1. No match, no candidates.
 *   2. Ambiguous, 2 candidates: one agrees on everything compared, the other has a phone typo
 *      and a different street number - two candidates, warning markers on the second.
 *   3. No match, 1 candidate: the name and state agree, the city, zip and phone differ.
 *
 *   - Multi-case scenarios. For a pending task, affectedCaseCount/affectedCaseIds are derived
 *     live by querying trustee-case-appointments for surrogate CASE_APPOINTMENT rows sharing the
 *     task's fingerprint (see getAffectedCaseIdsByFingerprint in
 *     trustee-match-verification.use-case.ts); once approved, they come from the affectedCaseIds
 *     snapshot taken at approval time instead, since the remap deletes the surrogates:
 *     4. Pending, 3 affected cases, one candidate.
 *     5. Already approved, with NO affectedCaseIds snapshot and NO surviving surrogate rows -
 *        simulates the state after trustee-verification-remap.ts has deleted every surrogate for
 *        a resolved fingerprint approved before the affectedCaseIds snapshot existed.
 *     6. Already approved, WITH a populated affectedCaseIds snapshot (3 cases) - the normal
 *        state for an approved multi-case task.
 *     7. Pending, 3 affected cases, all Chapter 11, but one case is in a different court the
 *        candidate has no appointment in at all (court+division mismatch rather than chapter
 *        mismatch), isolating the other half of isAppointmentMatch. See CAMS-905 PR #3090.
 *
 * Inactive-trustee/appointment variations are not identity tasks (an appointment concern, see
 * CAMS-956), so this scenario no longer seeds them.
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
const CASE_SINGLE_CANDIDATE = '091-99-92748'; // Ch 12 (Botsford LLC)

// Multi-case scenarios (3 distinct cases)
const CASE_MULTI_A = '091-99-86706';
const CASE_MULTI_B = '091-99-99943';
const CASE_MULTI_C = '091-99-98483';
const CASE_RESOLVED_NO_SURROGATES = '091-99-97816';

// Multi-case DIVISION-mismatch scenario (3 distinct cases, all Chapter 11): two share a
// court+division the candidate is appointed in, the third is a genuinely different court the
// candidate has no appointment for at all.
const CASE_DIVISION_MISMATCH_A = '091-99-40761'; // Ch 11, Western District of NY - Buffalo (091)
const CASE_DIVISION_MISMATCH_B = '091-99-11079'; // Ch 11, Western District of NY - Buffalo (091)
const CASE_DIVISION_MISMATCH_C = '081-23-10005'; // Ch 11, Southern District of NY - Manhattan (081)

// ── CAMS trustees ───────────────────────────────────────────────────────────
// Defined once and reused for both the trustees collection and each task's findings, so a
// candidate's stored camsRaw can never drift from the trustee it names.
const TRUSTEE_MULTI_A = createTrusteeBase({
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
});
const TRUSTEE_MULTI_B = createTrusteeBase({
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
});
const TRUSTEE_SINGLE_CANDIDATE = createTrusteeBase({
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
});
// The trustee the approved tasks below were resolved to.
const TRUSTEE_RESOLVED = createTrusteeBase({
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
});
const TRUSTEE_MULTI_CASE = createTrusteeBase({
  id: 'seed-trustee-match-multicase',
  firstName: 'Cassidy',
  lastName: 'Multicasematch',
  status: 'active',
  address1: '700 Match Ln',
  city: 'New York',
  state: 'NY',
  zipCode: '10007',
  phone: '212-555-7000',
  email: 'cassidy.multicasematch@example.com',
});
// Appointed in Buffalo (091) only, so division-mismatch cases A/B are covered but C (081) is not.
const TRUSTEE_DIVISION_MISMATCH = createTrusteeBase({
  id: 'seed-trustee-match-divisionmismatch',
  firstName: 'Dana',
  lastName: 'Divisionmismatch',
  status: 'active',
  address1: '800 Match Pl',
  city: 'Buffalo',
  state: 'NY',
  zipCode: '14201',
  phone: '716-555-8000',
  email: 'dana.divisionmismatch@example.com',
});

// ── DXTR source records ─────────────────────────────────────────────────────
// Shared between `fingerprint` (via computeFingerprint), `dxtrTrustee` and findings.sourceRaw, so
// the three can never drift out of sync with each other.
const DXTR_NO_MATCH = {
  firstName: 'Unique',
  lastName: 'Nomatch',
  fullName: 'Unique Nomatch',
  legacy: {
    address1: '1 Nowhere Rd',
    cityStateZipCountry: 'Albany NY 12207',
    phone: '518-555-0100',
    parsedCityStateZip: { city: 'Albany', state: 'NY', zipCode: '12207' },
  },
};
const DXTR_MULTIPLE_MATCH = {
  firstName: 'T',
  lastName: 'Multimatch',
  fullName: 'T Multimatch',
  legacy: {
    address1: '300 Match Ave',
    cityStateZipCountry: 'New York NY 10003',
    phone: '212-555-3000',
    parsedCityStateZip: { city: 'New York', state: 'NY', zipCode: '10003' },
  },
};
const DXTR_SINGLE_CANDIDATE = {
  firstName: 'J',
  lastName: 'Imperfectmatch',
  fullName: 'J Imperfectmatch',
  legacy: {
    address1: '400 Match Blvd',
    cityStateZipCountry: 'Albany NY 12207',
    phone: '518-555-9999',
    parsedCityStateZip: { city: 'Albany', state: 'NY', zipCode: '12207' },
  },
};
const DXTR_MULTI_CASE = {
  firstName: 'Casey',
  lastName: 'Multicasematch',
  fullName: 'Casey Multicasematch',
};
const DXTR_DIVISION_MISMATCH = {
  firstName: 'Devon',
  lastName: 'Divisionmismatch',
  fullName: 'Devon Divisionmismatch',
};
const DXTR_RESOLVED_NO_SURROGATES = {
  firstName: 'Riley',
  lastName: 'Resolvedmatch',
  fullName: 'Riley Resolvedmatch',
};
const DXTR_RESOLVED_WITH_SNAPSHOT = {
  firstName: 'Drew',
  lastName: 'Snapshotmatch',
  fullName: 'Drew Snapshotmatch',
};

type SeedTrustee = ReturnType<typeof createTrusteeBase>;
type Scores = Record<string, Record<string, unknown>>;

/** A findings candidate as the pipeline stores it: the projected CAMS trustee plus its scores. */
function candidate(trustee: SeedTrustee, scores: Scores, origin = 'recallBySurnameExact') {
  return {
    camsRaw: {
      trusteeId: trustee.trusteeId,
      firstName: trustee.firstName,
      lastName: trustee.lastName,
      name: trustee.name,
      address: trustee.public.address,
      phone: trustee.public.phone,
      email: trustee.public.email,
    },
    camsNormalized: {},
    memo: {},
    scores,
    origin,
  };
}

/** The pipeline's serialized state for an unresolved source record. */
function findings(sourceRaw: object, candidates: ReturnType<typeof candidate>[] = []) {
  return {
    sourceRaw,
    sourceNormalized: {},
    memo: {},
    candidates,
    match: null,
    skip: false,
    error: null,
  };
}

/** Fields every seeded identity task shares. */
function identityTask(dxtrTrustee: object & { fullName: string }) {
  return {
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    taskType: 'trustee-match',
    source: 'DXTR',
    fingerprint: computeFingerprint(dxtrTrustee),
    dxtrTrustee,
  };
}

// The only comparison a name-only source record supports: the given name was relaxed ("T" is an
// initial of "Taylor"), the surname matched outright.
const NAME_STRONG = { doesNameMatch: { pass: true, quality: 'strong' } };
// A surname match whose given name does not match at all ("Casey" vs "Cassidy").
const NAME_FAILS = { doesNameMatch: { pass: false } };

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  // Surrogates shared by the multi-case pending task below. Computed up front (rather than
  // inline in the array) so the fingerprint on the surrogates and the task can never drift apart.
  const multiCaseFingerprint = computeFingerprint(DXTR_MULTI_CASE);
  const multiCaseSurrogates = [CASE_MULTI_A, CASE_MULTI_B, CASE_MULTI_C].map((caseId) => ({
    id: `seed-surrogate-multicase-${caseId}`,
    documentType: 'CASE_APPOINTMENT',
    caseId,
    trusteeId: multiCaseFingerprint,
    assignedOn: '2018-01-01T00:00:00.000Z',
    appointedDate: '2018-01-01',
    isSurrogate: true,
    chapter: '11',
    courtDivisionCode: '091',
    createdOn: '2025-03-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  }));

  // Surrogates for the division-mismatch scenario. Unlike multiCaseSurrogates above, the
  // bookkeeping courtDivisionCode genuinely differs per case here (091 for A/B, 081 for C) --
  // that division difference is the whole point of this fixture, not an incidental detail.
  const divisionMismatchFingerprint = computeFingerprint(DXTR_DIVISION_MISMATCH);
  const divisionMismatchCaseDivisions: Record<string, string> = {
    [CASE_DIVISION_MISMATCH_A]: '091',
    [CASE_DIVISION_MISMATCH_B]: '091',
    [CASE_DIVISION_MISMATCH_C]: '081',
  };
  const divisionMismatchSurrogates = [
    CASE_DIVISION_MISMATCH_A,
    CASE_DIVISION_MISMATCH_B,
    CASE_DIVISION_MISMATCH_C,
  ].map((caseId) => ({
    id: `seed-surrogate-divisionmismatch-${caseId}`,
    documentType: 'CASE_APPOINTMENT',
    caseId,
    trusteeId: divisionMismatchFingerprint,
    assignedOn: '2018-01-01T00:00:00.000Z',
    appointedDate: '2018-01-01',
    isSurrogate: true,
    chapter: '11',
    courtDivisionCode: divisionMismatchCaseDivisions[caseId],
    createdOn: '2025-03-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  }));

  return [
    // ── Cosmos: Trustees named by the identity tasks ─────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        TRUSTEE_MULTI_A,
        TRUSTEE_MULTI_B,
        TRUSTEE_SINGLE_CANDIDATE,
        TRUSTEE_RESOLVED,
        TRUSTEE_MULTI_CASE,
        TRUSTEE_DIVISION_MISMATCH,
      ],
    },

    // Single active appointment for the division-mismatch candidate -- Buffalo (091) only, no
    // Manhattan (081) appointment. Chapter 11 everywhere, so this isolates the court+division
    // half of isAppointmentMatch from the chapter half CASE_MULTI_A/B/C already covers.
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-divisionmismatch',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: TRUSTEE_DIVISION_MISMATCH.trusteeId,
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '0209',
          divisionCodes: ['091'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Western District of New York',
          courtDivisionName: 'Buffalo',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Identity tasks ───────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        // 1. No match, no candidates.
        {
          id: `seed-match-no-match-${CASE_NO_MATCH}`,
          ...identityTask(DXTR_NO_MATCH),
          caseId: CASE_NO_MATCH,
          courtId: '0208',
          status: 'pending',
          taskDate: '2011-07-08T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_NO_MATCH),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },

        // 2. Ambiguous, 2 candidates. Taylor agrees on everything compared (geography 3 + street
        // 3 points = exact). Tyler's phone is one digit off (a likely typo, 'strong') and his
        // street number differs ("301" vs "300": 2 of 3 street tokens agree, 2 street points),
        // so he ranks second and his Phone and Street cells get the warning marker. The source
        // record has no email, so neither candidate has a doesEmailMatch score.
        {
          id: `seed-match-multiple-${CASE_MULTIPLE_MATCH}`,
          ...identityTask(DXTR_MULTIPLE_MATCH),
          caseId: CASE_MULTIPLE_MATCH,
          courtId: '0208',
          status: 'pending',
          taskDate: '2015-02-19T00:00:00.000Z',
          mismatchReason: 'ambiguous',
          findings: findings(DXTR_MULTIPLE_MATCH, [
            candidate(TRUSTEE_MULTI_A, {
              ...NAME_STRONG,
              doesCityMatch: { pass: true },
              doesStateMatch: { pass: true },
              doesZipCodeMatch: { pass: true },
              doesAddressMatch: { pass: true, quality: 'exact', points: 6, streetCloseness: 1 },
              doesPhoneMatch: { pass: true, quality: 'exact' },
            }),
            candidate(TRUSTEE_MULTI_B, {
              ...NAME_STRONG,
              doesCityMatch: { pass: true },
              doesStateMatch: { pass: true },
              doesZipCodeMatch: { pass: true },
              doesAddressMatch: {
                pass: true,
                quality: 'strong',
                points: 5,
                streetCloseness: 0.667,
              },
              doesPhoneMatch: { pass: true, quality: 'strong', phoneDigitDistance: 1 },
            }),
          ]),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },

        // 3. No match, 1 candidate. The source record is in Albany: the state agrees, the city
        // and zip differ (geography 1 point) and the street line agrees (3 points); the phone
        // is 6 digits off, a different number rather than a typo.
        {
          id: `seed-match-imperfect-${CASE_SINGLE_CANDIDATE}`,
          ...identityTask(DXTR_SINGLE_CANDIDATE),
          caseId: CASE_SINGLE_CANDIDATE,
          courtId: '0208',
          status: 'pending',
          taskDate: '2019-11-30T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_SINGLE_CANDIDATE, [
            candidate(TRUSTEE_SINGLE_CANDIDATE, {
              ...NAME_STRONG,
              doesCityMatch: { pass: false },
              doesStateMatch: { pass: true },
              doesZipCodeMatch: { pass: false },
              doesAddressMatch: { pass: true, quality: 'strong', points: 4, streetCloseness: 1 },
              doesPhoneMatch: { pass: false, phoneDigitDistance: 6 },
            }),
          ]),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 4. Pending multi-case task: 3 surrogate CASE_APPOINTMENTs sharing one fingerprint,
    // dual-written to both partitions (see TrusteeCaseAppointmentsMongoRepository's
    // casePartition/trusteePartition) so getSurrogatesByFingerprints can find them.
    {
      db: 'cams',
      collectionOrTable: 'case-trustee-appointments',
      data: multiCaseSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-case-appointments',
      data: multiCaseSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-multicase-${CASE_MULTI_A}`,
          ...identityTask(DXTR_MULTI_CASE),
          fingerprint: multiCaseFingerprint,
          caseId: CASE_MULTI_A,
          courtId: '0208',
          status: 'pending',
          taskDate: '2018-01-01T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_MULTI_CASE, [candidate(TRUSTEE_MULTI_CASE, NAME_FAILS)]),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 7. Pending division-mismatch multi-case task: 3 surrogate CASE_APPOINTMENTs sharing one
    // fingerprint (same dual-write pattern as the bundle above). Dana Divisionmismatch covers
    // CASE_DIVISION_MISMATCH_A/B (Buffalo, 091) but not CASE_DIVISION_MISMATCH_C (Manhattan,
    // 081) -- approving this candidate should reject naming only case C.
    {
      db: 'cams',
      collectionOrTable: 'case-trustee-appointments',
      data: divisionMismatchSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-case-appointments',
      data: divisionMismatchSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-divisionmismatch-${CASE_DIVISION_MISMATCH_A}`,
          ...identityTask(DXTR_DIVISION_MISMATCH),
          fingerprint: divisionMismatchFingerprint,
          caseId: CASE_DIVISION_MISMATCH_A,
          courtId: '0209',
          status: 'pending',
          taskDate: '2018-01-01T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_DIVISION_MISMATCH, [
            candidate(TRUSTEE_DIVISION_MISMATCH, NAME_FAILS),
          ]),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 5. Already-approved task, no surviving surrogates: simulates the state after
    // trustee-verification-remap.ts has deleted every surrogate for this fingerprint, so
    // getAffectedCaseIdsByFingerprint returns an empty array.
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-resolved-no-surrogates-${CASE_RESOLVED_NO_SURROGATES}`,
          ...identityTask(DXTR_RESOLVED_NO_SURROGATES),
          caseId: CASE_RESOLVED_NO_SURROGATES,
          courtId: '0208',
          status: 'approved',
          taskDate: '2018-06-01T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_RESOLVED_NO_SURROGATES),
          resolvedTrusteeId: TRUSTEE_RESOLVED.trusteeId,
          resolvedTrusteeName: TRUSTEE_RESOLVED.name,
          updatedOn: '2025-06-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // 6. Already-approved multi-case task WITH a populated affectedCaseIds snapshot (see the doc
    // comment on TrusteeMatchVerification.affectedCaseIds in
    // common/src/cams/trustee-match-verification.ts). No surrogate rows are seeded for this
    // fingerprint - approval's remap would have deleted them, so the snapshot is the only
    // source for this task's affected cases.
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: [
        {
          id: `seed-match-resolved-with-snapshot-${CASE_MULTI_A}`,
          ...identityTask(DXTR_RESOLVED_WITH_SNAPSHOT),
          caseId: CASE_MULTI_A,
          courtId: '0208',
          status: 'approved',
          taskDate: '2018-06-01T00:00:00.000Z',
          mismatchReason: 'no match',
          findings: findings(DXTR_RESOLVED_WITH_SNAPSHOT),
          resolvedTrusteeId: TRUSTEE_RESOLVED.trusteeId,
          resolvedTrusteeName: TRUSTEE_RESOLVED.name,
          affectedCaseIds: [CASE_MULTI_A, CASE_MULTI_B, CASE_MULTI_C],
          updatedOn: '2025-06-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
