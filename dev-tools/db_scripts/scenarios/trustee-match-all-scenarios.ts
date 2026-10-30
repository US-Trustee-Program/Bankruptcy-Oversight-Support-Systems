/**
 * Scenario: trustee-match-all-scenarios
 * Database: cams only
 *
 * Seeds trustee identity tasks (TRUSTEE_MATCH_VERIFICATION documents) the way the DXTR trustee
 * appointment sync writes them: source 'DXTR', the trustee-match pipeline's serialized state as
 * `findings`, and mismatchReason 'ambiguous' (2+ candidates) or 'no match' (0 or 1 candidate).
 * A resolved pipeline match writes the appointment instead, so it has no document to seed here.
 *
 * Each task's findings, DXTR source and candidate trustees come from a trustee-match fixture
 * scenario (common/src/cams/test-utilities/trustee-match-findings.scenarios.ts), whose findings
 * are the real pipeline's output. No score is written by hand:
 *
 *   1. No match, no candidates (noCandidates).
 *   2. Ambiguous, 2 candidates that tie on every resolver (multipleCandidates).
 *   3. No match, 1 candidate whose name, address and phone differ
 *      (oneCandidateAddressAndPhoneDiffer).
 *   3a-3d. No match, 1 candidate, one per remaining explanation-sentence shape
 *      (oneCandidateStateDiffers, oneCandidateNameAddressEmailDiffer, oneCandidateExactName,
 *      oneCandidateNothingDiffers).
 *   Each single-case task has one surrogate CASE_APPOINTMENT for its case, as the sync writes, so
 *   approving it runs the same division check and remap as a real task.
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

import type { TrusteeMatchScenarioKey } from '@common/cams/test-utilities/trustee-match-findings.scenarios.js';
import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';
import {
  identityTaskFields,
  scenarioTrusteeDocuments,
} from '../lib/trustee-match-scenario-seeds.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Existing DXTR cases (Buffalo district) for the single-case pending tasks. Each task has its case
// to itself and no other scenario seeds an appointment on it: the sync only raises a task for a
// case whose trustee it could not resolve.
const SINGLE_CASE_TASKS = [
  {
    slug: 'no-match',
    key: 'noCandidates',
    caseId: '091-99-10249',
    chapter: '11',
    taskDate: '2011-07-08T00:00:00.000Z',
  },
  {
    slug: 'multiple',
    key: 'multipleCandidates',
    caseId: '091-99-00874',
    chapter: '11',
    taskDate: '2015-02-19T00:00:00.000Z',
  },
  {
    slug: 'imperfect',
    key: 'oneCandidateAddressAndPhoneDiffer',
    caseId: '091-99-92748', // Botsford LLC
    chapter: '12',
    taskDate: '2019-11-30T00:00:00.000Z',
  },
  {
    slug: 'state-differs',
    key: 'oneCandidateStateDiffers',
    caseId: '091-99-11333',
    chapter: '11',
    taskDate: '2012-04-16T00:00:00.000Z',
  },
  {
    slug: 'name-address-email',
    key: 'oneCandidateNameAddressEmailDiffer',
    caseId: '091-99-14442',
    chapter: '11',
    taskDate: '2016-09-02T00:00:00.000Z',
  },
  {
    slug: 'exact-name',
    key: 'oneCandidateExactName',
    caseId: '091-99-16370',
    chapter: '11',
    taskDate: '2020-03-11T00:00:00.000Z',
  },
  {
    slug: 'nothing-differs',
    key: 'oneCandidateNothingDiffers',
    caseId: '091-99-00711',
    chapter: '12',
    taskDate: '2021-08-24T00:00:00.000Z',
  },
] as const satisfies readonly {
  slug: string;
  key: TrusteeMatchScenarioKey;
  caseId: string;
  chapter: string;
  taskDate: string;
}[];

// Multi-case scenarios (3 distinct cases, all Chapter 11, Buffalo). None of these cases carries
// another scenario's trustee appointments: the sync only raises a task for a case whose trustee
// it could not resolve.
const CASE_MULTI_A = '091-99-25850';
const CASE_MULTI_B = '091-99-26681';
const CASE_MULTI_C = '091-99-26914';
const CASE_RESOLVED_NO_SURROGATES = '091-99-28263';

// Multi-case DIVISION-mismatch scenario (3 distinct cases, all Chapter 11): two share a
// court+division the candidate is appointed in, the third is a genuinely different court the
// candidate has no appointment for at all.
const CASE_DIVISION_MISMATCH_A = '091-99-40761'; // Ch 11, Western District of NY - Buffalo (091)
const CASE_DIVISION_MISMATCH_B = '091-99-11079'; // Ch 11, Western District of NY - Buffalo (091)
const CASE_DIVISION_MISMATCH_C = '081-23-10005'; // Ch 11, Southern District of NY - Manhattan (081)

// The trustee the approved tasks below were resolved to. Not a candidate in any scenario.
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
const DIVISION_MISMATCH_TRUSTEE_ID = 'seed-trustee-match-divisionmismatch';

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const singleCaseTasks = SINGLE_CASE_TASKS.map(({ slug, key, caseId, taskDate }) => ({
    id: `seed-match-${slug}-${caseId}`,
    ...identityTaskFields(key),
    caseId,
    courtId: '0209',
    status: 'pending',
    taskDate,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  }));
  const singleCaseSurrogates = SINGLE_CASE_TASKS.map(({ slug, caseId, chapter }, index) => ({
    id: `seed-surrogate-${slug}-${caseId}`,
    documentType: 'CASE_APPOINTMENT',
    caseId,
    trusteeId: singleCaseTasks[index].fingerprint,
    assignedOn: '2018-01-01T00:00:00.000Z',
    appointedDate: '2018-01-01',
    isSurrogate: true,
    chapter,
    courtDivisionCode: '091',
    createdOn: '2025-03-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  }));

  // Surrogates shared by the multi-case pending task below. Computed up front (rather than
  // inline in the array) so the fingerprint on the surrogates and the task can never drift apart.
  const multiCaseTask = identityTaskFields('multiCase');
  const multiCaseFingerprint = multiCaseTask.fingerprint;
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
  const divisionMismatchTask = identityTaskFields('divisionMismatch');
  const divisionMismatchFingerprint = divisionMismatchTask.fingerprint;
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
        ...scenarioTrusteeDocuments(
          'multipleCandidates',
          'oneCandidateAddressAndPhoneDiffer',
          'oneCandidateStateDiffers',
          'oneCandidateNameAddressEmailDiffer',
          'oneCandidateExactName',
          'oneCandidateNothingDiffers',
          'multiCase',
          'divisionMismatch',
        ),
        TRUSTEE_RESOLVED,
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
          trusteeId: DIVISION_MISMATCH_TRUSTEE_ID,
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

    // ── Cosmos: Single-case identity tasks ──────────────────────────────────
    // 1-3d. One pending task per scenario, each with the surrogate the sync writes for its case,
    // dual-written to both partitions like the multi-case bundles below.
    {
      db: 'cams',
      collectionOrTable: 'case-trustee-appointments',
      data: singleCaseSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-case-appointments',
      data: singleCaseSurrogates,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-match-verification',
      data: singleCaseTasks,
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
          ...multiCaseTask,
          caseId: CASE_MULTI_A,
          courtId: '0209',
          status: 'pending',
          taskDate: '2018-01-01T00:00:00.000Z',
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
          ...divisionMismatchTask,
          caseId: CASE_DIVISION_MISMATCH_A,
          courtId: '0209',
          status: 'pending',
          taskDate: '2018-01-01T00:00:00.000Z',
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
          ...identityTaskFields('resolvedNoSurrogates'),
          caseId: CASE_RESOLVED_NO_SURROGATES,
          courtId: '0209',
          status: 'approved',
          taskDate: '2018-06-01T00:00:00.000Z',
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
          ...identityTaskFields('resolvedWithSnapshot'),
          caseId: CASE_MULTI_A,
          courtId: '0209',
          status: 'approved',
          taskDate: '2018-06-01T00:00:00.000Z',
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
