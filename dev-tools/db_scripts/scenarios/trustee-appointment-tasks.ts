/**
 * Scenario: trustee-appointment-tasks
 * Database: cams, plus DXTR (AO_CS/AO_PY) rows for the generated cases
 *
 * Seeds "Trustee Appointment" data-verification tasks (CAMS-956): TRUSTEE_APPOINTMENT_VERIFICATION
 * documents, one per (trustee, court, division, chapter), each joined by the cases whose
 * CASE_APPOINTMENT the trustee holds without an active covering trustee appointment. Each task's
 * cases carry a CASE_APPOINTMENT with checks.matchedTrusteeAppointment false (dual-written to
 * both partitions, like the identity-task surrogates), which is what "Refresh Trustee
 * Appointments" flips to true.
 *
 *   1. No appointments at all (Buffalo Ch 11, 1 case): the Appointments table is replaced with
 *      "This trustee has no appointments in CAMS." Add a covering appointment on the trustee's
 *      profile, then refresh, to watch the task resolve.
 *   2. No covering appointment, but other appointments that differ in district, division,
 *      chapter or status (Manhattan Ch 12, 3 cases): 7 appointments, so the table paginates and
 *      shows warning icons. The same trustee also has task 3.
 *   3. Same trustee as task 2, a second tuple (Delaware Ch 13, 1 case): one trustee, two tasks.
 *   4. Appointment inactive (Buffalo Ch 12, 2 cases): the reason sentence for an inactive
 *      appointment.
 *   5. Ready to resolve (Delaware Ch 7, 3 cases): the trustee already holds an active covering
 *      appointment, so Refresh Trustee Appointments resolves the task and covers all 3 cases.
 *   6. Already resolved (Delaware Ch 7, 1 case): shown only when the queue includes approved tasks.
 *   7. Many cases (Manhattan Ch 7, 12 cases): a long affected-case list.
 *   8. Unresolvable court names (court 0674 / division 674, Ch 12, 2 cases): the queue row and
 *      the subject fall back to the codes. Its trustee holds an active Ch 7 appointment there.
 *   9. Partial coverage (Delaware Ch 7, 3 cases): the trustee holds a covering appointment, but
 *      one case's appointment was closed and one was reassigned to another trustee, so Refresh
 *      covers only 1 of the 3 ("verified for 1 case").
 *  10. Records that must never join a task: a placeholder (checks.matchedTrustee false) and a
 *      parked record (CASE_APPOINTMENT_UNATTACHED). Neither appears in any task's case list.
 *
 * Identity tasks whose approval reaches an appointment task (each with one surrogate case):
 *  11. Join (Jules Joinmatch -> Julia Joinmatch, Manhattan Ch 13): Julia already has an open task
 *      on that tuple with 1 case, so approving grows it to 2 cases and opens no new task.
 *  12. Reopen (Remy Reopenmatch -> Rowena Reopenmatch, Delaware Ch 13): Rowena's task on that
 *      tuple was resolved, then her appointment resigned, so approving reopens it. A reopen resets
 *      the task's cases to just the new one: the cases it held were verified when it resolved.
 *  13. Stale preview (V Coverpair -> Vera or Vince Coverpair, Manhattan Ch 7): Vera covers the
 *      case and Vince does not, so the approval preview differs by candidate. Switching between
 *      them shows whether a preview for one candidate can appear for the other.
 *
 * Trustee appointments exist only for Chapters 7, 11, 12 and 13, so every task and appointment
 * here uses one of those. Cases:
 *  - Buffalo and court 0674 tasks reuse cases from cases-fuzzy-search.ts, which must be seeded
 *    first (a default run does; `--scenario=trustee-appointment-tasks` alone does not).
 *  - The Manhattan and Delaware tasks need Ch 7/12/13 cases, and the seeded ones there are all
 *    Ch 15, so this scenario seeds its own generated cases (SEED ids in the seed range) and the
 *    DXTR rows behind them, so each case's detail page loads. Seeding needs the DXTR SQL
 *    connection (MSSQL_*), which the Cosmos instances share. Manhattan is court 0208 and
 *    Delaware is court 0311 (division 111, group WL), as in DXTR.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createCaseDocument, createTrusteeBase } from '../lib/test-data-utils.js';
import {
  buildSurrogate,
  identityTaskFields,
  scenarioTrusteeDocuments,
} from '../lib/trustee-match-scenario-seeds.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const SEEDED_ON = '2026-11-10T00:00:00.000Z';

type Tuple = { courtId: string; divisionCode: string; chapter: string };

const BUFFALO = { courtId: '0209', divisionCode: '091' };
const BUFFALO_NAMES = {
  courtName: 'Western District of New York',
  courtDivisionName: 'Buffalo',
};
const MANHATTAN = { courtId: '0208', divisionCode: '081' };
const MANHATTAN_NAMES = {
  courtName: 'Southern District of New York',
  courtDivisionName: 'Manhattan',
};
const DELAWARE = { courtId: '0311', divisionCode: '111' };
const DELAWARE_NAMES = {
  courtName: 'District of Delaware',
  courtDivisionName: 'Delaware',
};

function trustee(id: string, firstName: string, lastName: string) {
  return createTrusteeBase({
    id,
    firstName,
    lastName,
    status: 'active',
    address1: '700 Appointment Ave',
    city: 'New York',
    state: 'NY',
    zipCode: '10007',
    phone: '212-555-7000',
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
  });
}

function appointment(opts: {
  id: string;
  trusteeId: string;
  chapter: string;
  appointmentType: string;
  court: typeof BUFFALO & typeof BUFFALO_NAMES;
  status: string;
  appointedDate?: string;
}) {
  const { court } = opts;
  return {
    id: opts.id,
    documentType: 'TRUSTEE_APPOINTMENT',
    trusteeId: opts.trusteeId,
    chapter: opts.chapter,
    appointmentType: opts.appointmentType,
    courtId: court.courtId,
    divisionCodes: [court.divisionCode],
    divisionCode: court.divisionCode,
    appointedDate: opts.appointedDate ?? '2020-01-01',
    status: opts.status,
    effectiveDate: opts.appointedDate ?? '2020-01-01',
    courtName: court.courtName,
    courtDivisionName: court.courtDivisionName,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };
}

const BUFFALO_COURT = { ...BUFFALO, ...BUFFALO_NAMES };
const MANHATTAN_COURT = { ...MANHATTAN, ...MANHATTAN_NAMES };
const DELAWARE_COURT = { ...DELAWARE, ...DELAWARE_NAMES };

type Court = typeof BUFFALO_COURT;
type Geography = { regionId: string; regionName: string; state: string; groupDesignator: string };
const NEW_YORK: Geography = {
  regionId: '02',
  regionName: 'NEW YORK',
  state: 'NY',
  groupDesignator: 'NY',
};
const DELAWARE_GEOGRAPHY: Geography = {
  regionId: '03',
  regionName: 'PHILADELPHIA',
  state: 'DE',
  groupDesignator: 'WL',
};

/**
 * Cosmos-only cases for tasks whose divisions have no seeded case with an appointable chapter.
 * Case numbers start at `start` (seed range 90000-99999, so unseed removes them) and the DXTR id
 * is the generated SEED form; there is no DXTR row behind them. Built once at module load so
 * every generate() call returns the same ids.
 */
function seedCaseSet(
  start: number,
  court: Court,
  geography: Geography,
  chapter: string,
  count: number,
) {
  const docs = Array.from({ length: count }, (_, index) => {
    const number = start + index;
    return createCaseDocument({
      dxtrStrategy: 'generated',
      dxtrId: `SEED${number}`,
      caseId: `${court.divisionCode}-26-${number}`,
      caseNumber: `26-${number}`,
      chapter,
      caseTitle: `Appointment Task Debtor ${number}`,
      dateFiled: '2026-09-01',
      officeName: court.courtDivisionName,
      officeCode: `USTP_CAMS_Region_${geography.regionId}_Office_${court.divisionCode}`,
      courtId: court.courtId,
      courtName: court.courtName,
      courtDivisionCode: court.divisionCode,
      courtDivisionName: court.courtDivisionName,
      groupDesignator: geography.groupDesignator,
      regionId: geography.regionId,
      regionName: geography.regionName,
      debtorName: `Appointment Task Debtor ${number}`,
      updatedOn: SEEDED_ON,
      updatedBy: SEEDER,
    });
  });
  // The DXTR rows behind each case, in the shape ensureDxtrCase writes, so the case detail page
  // loads: the case master (AO_CS) and its debtor (AO_PY), plus the petition below.
  const dxtrCases = docs.map((doc) => ({
    CS_CASEID: doc.dxtrId,
    COURT_ID: doc.courtId,
    CS_CASE_NUMBER: (doc.caseNumber as string).split('-')[1],
    CS_DIV: doc.courtDivisionCode,
    GRP_DES: doc.groupDesignator,
    CASE_ID: doc.caseNumber,
    CS_SHORT_TITLE: doc.caseTitle,
    CS_CHAPTER: doc.chapter,
    CS_TYPE: 'bk',
    CS_FEE_STATUS: 'p',
    CS_JOINT: 'n',
    CS_VOL_INVOL: 'v',
    CS_DATE_FILED: new Date(doc.dateFiled as string),
  }));
  const dxtrDebtors = docs.map((doc) => ({
    CS_CASEID: doc.dxtrId,
    COURT_ID: doc.courtId,
    PY_ROLE: 'DB',
    PY_LAST_NAME: doc.caseTitle,
    PY_FIRST_NAME: null,
    PY_MIDDLE_NAME: null,
    PY_ADDRESS1: '123 Test St',
    PY_ADDRESS2: null,
    PY_ADDRESS3: null,
    PY_CITY: 'Test City',
    PY_STATE: geography.state,
    PY_ZIP: '10001',
    PY_COUNTRY: 'United States',
  }));
  // The case summary query inner-joins the petition transaction (AO_TX type 1, code 1) and reads
  // the debtor type from characters 34-35 and the petition code from 108-109 of its fixed-width
  // REC. TX_ID is an identity column, so it is left to SQL Server.
  const dxtrPetitions = docs.map((doc) => ({
    CS_CASEID: doc.dxtrId,
    COURT_ID: doc.courtId,
    DE_SEQNO: 1,
    CASE_ID: doc.caseNumber,
    JOB_ID: 0,
    TX_TYPE: '1',
    TX_CODE: '1',
    TX_DATE: new Date(doc.dateFiled as string),
    REC: `${' '.repeat(33)}IC${' '.repeat(72)}VP${' '.repeat(6)}`,
  }));
  return {
    docs,
    dxtrCases,
    dxtrDebtors,
    dxtrPetitions,
    caseIds: docs.map((doc) => doc.caseId as string),
  };
}

const MISMATCH_MANHATTAN_CASES = seedCaseSet(90101, MANHATTAN_COURT, NEW_YORK, '12', 3);
const MISMATCH_DELAWARE_CASES = seedCaseSet(90111, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '13', 1);
const READY_CASES = seedCaseSet(90121, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '7', 3);
const RESOLVED_CASES = seedCaseSet(90131, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '7', 1);
const MANY_CASES = seedCaseSet(90141, MANHATTAN_COURT, NEW_YORK, '7', 12);
const PARTIAL_CASES = seedCaseSet(90161, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '7', 3);
const PLACEHOLDER_CASES = seedCaseSet(90171, MANHATTAN_COURT, NEW_YORK, '7', 1);
const JOIN_TASK_CASES = seedCaseSet(90181, MANHATTAN_COURT, NEW_YORK, '13', 1);
const JOIN_IDENTITY_CASES = seedCaseSet(90182, MANHATTAN_COURT, NEW_YORK, '13', 1);
const REOPEN_TASK_CASES = seedCaseSet(90183, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '13', 1);
const REOPEN_IDENTITY_CASES = seedCaseSet(90184, DELAWARE_COURT, DELAWARE_GEOGRAPHY, '13', 1);
const STALE_IDENTITY_CASES = seedCaseSet(90185, MANHATTAN_COURT, NEW_YORK, '7', 1);
const GENERATED_CASE_SETS = [
  MISMATCH_MANHATTAN_CASES,
  MISMATCH_DELAWARE_CASES,
  READY_CASES,
  RESOLVED_CASES,
  MANY_CASES,
  PARTIAL_CASES,
  PLACEHOLDER_CASES,
  JOIN_TASK_CASES,
  JOIN_IDENTITY_CASES,
  REOPEN_TASK_CASES,
  REOPEN_IDENTITY_CASES,
  STALE_IDENTITY_CASES,
];
const GENERATED_CASES = GENERATED_CASE_SETS.flatMap((set) => set.docs);
const GENERATED_DXTR_CASES = GENERATED_CASE_SETS.flatMap((set) => set.dxtrCases);
const GENERATED_DXTR_DEBTORS = GENERATED_CASE_SETS.flatMap((set) => set.dxtrDebtors);
const GENERATED_DXTR_PETITIONS = GENERATED_CASE_SETS.flatMap((set) => set.dxtrPetitions);

const T_NONE = 'seed-trustee-appt-none';
const T_MISMATCH = 'seed-trustee-appt-mismatch';
const T_INACTIVE = 'seed-trustee-appt-inactive';
const T_READY = 'seed-trustee-appt-ready';
const T_RESOLVED = 'seed-trustee-appt-resolved';
const T_MANY = 'seed-trustee-appt-many';
const T_NAMELESS = 'seed-trustee-appt-nocourtname';
const T_PARTIAL = 'seed-trustee-appt-partial';
const T_REASSIGNED_TO = 'seed-trustee-appt-reassignedto';
// The identity-task candidates (trustee-match-findings.scenarios.ts names them).
const T_JOIN = 'seed-trustee-match-join';
const T_REOPEN = 'seed-trustee-match-reopen';
const T_COVER_A = 'seed-trustee-match-cover-a';

type TaskSpec = {
  slug: string;
  trusteeId: string;
  tuple: Tuple;
  reason: 'no-appointment' | 'appointment-inactive';
  caseIds: string[];
  status: 'pending' | 'approved';
  createdOn: string;
};

const TASKS: TaskSpec[] = [
  {
    slug: 'none-buffalo-11',
    trusteeId: T_NONE,
    tuple: { ...BUFFALO, chapter: '11' },
    reason: 'no-appointment',
    caseIds: ['091-99-78269'],
    status: 'pending',
    createdOn: '2026-11-09T14:00:00.000Z',
  },
  {
    slug: 'mismatch-manhattan-12',
    trusteeId: T_MISMATCH,
    tuple: { ...MANHATTAN, chapter: '12' },
    reason: 'no-appointment',
    caseIds: MISMATCH_MANHATTAN_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-08T14:00:00.000Z',
  },
  {
    slug: 'mismatch-delaware-13',
    trusteeId: T_MISMATCH,
    tuple: { ...DELAWARE, chapter: '13' },
    reason: 'no-appointment',
    caseIds: MISMATCH_DELAWARE_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-08T15:00:00.000Z',
  },
  {
    slug: 'inactive-buffalo-12',
    trusteeId: T_INACTIVE,
    tuple: { ...BUFFALO, chapter: '12' },
    reason: 'appointment-inactive',
    caseIds: ['091-99-74857', '091-99-58624'],
    status: 'pending',
    createdOn: '2026-11-07T14:00:00.000Z',
  },
  {
    slug: 'ready-delaware-7',
    trusteeId: T_READY,
    tuple: { ...DELAWARE, chapter: '7' },
    reason: 'no-appointment',
    caseIds: READY_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-06T14:00:00.000Z',
  },
  {
    slug: 'resolved-delaware-7',
    trusteeId: T_RESOLVED,
    tuple: { ...DELAWARE, chapter: '7' },
    reason: 'no-appointment',
    caseIds: RESOLVED_CASES.caseIds,
    status: 'approved',
    createdOn: '2026-11-03T14:00:00.000Z',
  },
  {
    slug: 'many-manhattan-7',
    trusteeId: T_MANY,
    tuple: { ...MANHATTAN, chapter: '7' },
    reason: 'no-appointment',
    caseIds: MANY_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-05T14:00:00.000Z',
  },
  {
    slug: 'nocourtname-0674-12',
    trusteeId: T_NAMELESS,
    tuple: { courtId: '0674', divisionCode: '674', chapter: '12' },
    reason: 'no-appointment',
    caseIds: ['674-75-55581', '674-98-89371'],
    status: 'pending',
    createdOn: '2026-11-04T14:00:00.000Z',
  },
  {
    slug: 'partial-delaware-7',
    trusteeId: T_PARTIAL,
    tuple: { ...DELAWARE, chapter: '7' },
    reason: 'no-appointment',
    caseIds: PARTIAL_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-02T14:00:00.000Z',
  },
  {
    slug: 'join-manhattan-13',
    trusteeId: T_JOIN,
    tuple: { ...MANHATTAN, chapter: '13' },
    reason: 'no-appointment',
    caseIds: JOIN_TASK_CASES.caseIds,
    status: 'pending',
    createdOn: '2026-11-01T14:00:00.000Z',
  },
  {
    slug: 'reopen-delaware-13',
    trusteeId: T_REOPEN,
    tuple: { ...DELAWARE, chapter: '13' },
    reason: 'no-appointment',
    caseIds: REOPEN_TASK_CASES.caseIds,
    status: 'approved',
    createdOn: '2026-10-30T14:00:00.000Z',
  },
];

type IdentityTaskSpec = {
  slug: string;
  key: 'joinsAppointmentTask' | 'reopensAppointmentTask' | 'twoCandidatesOneCovers';
  court: typeof MANHATTAN;
  chapter: string;
  caseId: string;
  taskDate: string;
};

const IDENTITY_TASKS: IdentityTaskSpec[] = [
  {
    slug: 'join',
    key: 'joinsAppointmentTask',
    court: MANHATTAN,
    chapter: '13',
    caseId: JOIN_IDENTITY_CASES.caseIds[0],
    taskDate: '2026-11-10T00:00:00.000Z',
  },
  {
    slug: 'reopen',
    key: 'reopensAppointmentTask',
    court: DELAWARE,
    chapter: '13',
    caseId: REOPEN_IDENTITY_CASES.caseIds[0],
    taskDate: '2026-11-11T00:00:00.000Z',
  },
  {
    slug: 'stale',
    key: 'twoCandidatesOneCovers',
    court: MANHATTAN,
    chapter: '7',
    caseId: STALE_IDENTITY_CASES.caseIds[0],
    taskDate: '2026-11-12T00:00:00.000Z',
  },
];

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const trustees = [
    trustee(T_NONE, 'Pat', 'Noappointments'),
    trustee(T_MISMATCH, 'Morgan', 'Mismatchappt'),
    trustee(T_INACTIVE, 'Ines', 'Inactiveappt'),
    trustee(T_READY, 'Ria', 'Readyappt'),
    trustee(T_RESOLVED, 'Rae', 'Resolvedappt'),
    trustee(T_MANY, 'Mary', 'Manycasesappt'),
    trustee(T_NAMELESS, 'Nolan', 'Nocourtnameappt'),
    trustee(T_PARTIAL, 'Paige', 'Partialappt'),
    trustee(T_REASSIGNED_TO, 'Reese', 'Reassignedtoappt'),
    ...scenarioTrusteeDocuments(...IDENTITY_TASKS.map((task) => task.key)),
  ];

  const appointments = [
    // T_NONE: deliberately none.

    // T_MISMATCH: seven appointments (a second page of the table), none covering Manhattan Ch 12
    // or Delaware Ch 13. Ordered in the table by how closely each agrees with the task's tuple.
    appointment({
      id: 'seed-appt-mismatch-1',
      trusteeId: T_MISMATCH,
      chapter: '7',
      appointmentType: 'panel',
      court: MANHATTAN_COURT,
      status: 'active',
    }),
    appointment({
      id: 'seed-appt-mismatch-2',
      trusteeId: T_MISMATCH,
      chapter: '11',
      appointmentType: 'case-by-case',
      court: MANHATTAN_COURT,
      status: 'active',
      appointedDate: '2021-03-01',
    }),
    appointment({
      id: 'seed-appt-mismatch-3',
      trusteeId: T_MISMATCH,
      chapter: '13',
      appointmentType: 'standing',
      court: MANHATTAN_COURT,
      status: 'resigned',
      appointedDate: '2019-06-01',
    }),
    appointment({
      id: 'seed-appt-mismatch-4',
      trusteeId: T_MISMATCH,
      chapter: '13',
      appointmentType: 'case-by-case',
      court: BUFFALO_COURT,
      status: 'active',
      appointedDate: '2022-01-15',
    }),
    appointment({
      id: 'seed-appt-mismatch-5',
      trusteeId: T_MISMATCH,
      chapter: '7',
      appointmentType: 'off-panel',
      court: DELAWARE_COURT,
      status: 'resigned',
      appointedDate: '2018-09-01',
    }),
    appointment({
      id: 'seed-appt-mismatch-6',
      trusteeId: T_MISMATCH,
      chapter: '12',
      appointmentType: 'standing',
      court: BUFFALO_COURT,
      status: 'active',
      appointedDate: '2023-02-01',
    }),
    appointment({
      id: 'seed-appt-mismatch-7',
      trusteeId: T_MISMATCH,
      chapter: '11',
      appointmentType: 'case-by-case',
      court: DELAWARE_COURT,
      status: 'inactive',
      appointedDate: '2017-05-01',
    }),

    // T_INACTIVE: the covering Buffalo Ch 12 appointment exists but is not active, plus one
    // unrelated active appointment.
    appointment({
      id: 'seed-appt-inactive-1',
      trusteeId: T_INACTIVE,
      chapter: '12',
      appointmentType: 'standing',
      court: BUFFALO_COURT,
      status: 'resigned',
    }),
    appointment({
      id: 'seed-appt-inactive-2',
      trusteeId: T_INACTIVE,
      chapter: '7',
      appointmentType: 'panel',
      court: BUFFALO_COURT,
      status: 'active',
      appointedDate: '2021-01-01',
    }),

    // T_READY: an active appointment already covers Delaware Ch 7, so refreshing resolves the task.
    appointment({
      id: 'seed-appt-ready-1',
      trusteeId: T_READY,
      chapter: '7',
      appointmentType: 'panel',
      court: DELAWARE_COURT,
      status: 'active',
      appointedDate: '2026-11-08',
    }),

    // T_RESOLVED: covered, so its task was resolved.
    appointment({
      id: 'seed-appt-resolved-1',
      trusteeId: T_RESOLVED,
      chapter: '7',
      appointmentType: 'panel',
      court: DELAWARE_COURT,
      status: 'active',
      appointedDate: '2026-10-20',
    }),
    // T_MANY: no appointments, so the long case list is the only thing to look at.
    // T_NAMELESS: an unrelated active Ch 7 appointment in the court whose name cannot be resolved.
    appointment({
      id: 'seed-appt-nocourtname-1',
      trusteeId: T_NAMELESS,
      chapter: '7',
      appointmentType: 'panel',
      court: {
        courtId: '0674',
        divisionCode: '674',
        courtName: 'Unknown',
        courtDivisionName: 'Unknown',
      },
      status: 'active',
    }),
    // T_PARTIAL: covers Delaware Ch 7, so refreshing resolves the task, but only for the cases
    // still assigned to this trustee on the tuple.
    appointment({
      id: 'seed-appt-partial-1',
      trusteeId: T_PARTIAL,
      chapter: '7',
      appointmentType: 'panel',
      court: DELAWARE_COURT,
      status: 'active',
      appointedDate: '2026-11-08',
    }),
    appointment({
      id: 'seed-appt-reassignedto-1',
      trusteeId: T_REASSIGNED_TO,
      chapter: '7',
      appointmentType: 'panel',
      court: DELAWARE_COURT,
      status: 'active',
      appointedDate: '2026-11-01',
    }),

    // T_JOIN: deliberately none, so its open Manhattan Ch 13 task stays uncovered.
    // T_REOPEN: covered Delaware Ch 13 when its task was resolved, then resigned.
    appointment({
      id: 'seed-appt-reopen-1',
      trusteeId: T_REOPEN,
      chapter: '13',
      appointmentType: 'standing',
      court: DELAWARE_COURT,
      status: 'resigned',
      appointedDate: '2026-10-25',
    }),
    // T_COVER_A covers Manhattan Ch 7; its fellow candidate (cover-b) has no appointments.
    appointment({
      id: 'seed-appt-cover-a-1',
      trusteeId: T_COVER_A,
      chapter: '7',
      appointmentType: 'panel',
      court: MANHATTAN_COURT,
      status: 'active',
    }),
  ];

  const tasks = TASKS.map((task) => ({
    id: `seed-appt-task-${task.slug}`,
    documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
    taskType: 'trustee-appointment',
    trusteeId: task.trusteeId,
    ...task.tuple,
    reason: task.reason,
    caseIds: task.caseIds,
    status: task.status,
    createdOn: task.createdOn,
    createdBy: SEEDER,
    updatedOn: task.status === 'approved' ? SEEDED_ON : task.createdOn,
    updatedBy: SEEDER,
  }));

  // The partial-coverage task's second and third cases no longer count: one appointment was
  // closed, the other case was reassigned to another trustee. Refresh skips both.
  const [, CLOSED_CASE, REASSIGNED_CASE] = PARTIAL_CASES.caseIds;
  const taskCaseAppointments = TASKS.flatMap((task) =>
    task.caseIds.map((caseId) => ({
      id: `seed-case-appt-${task.slug}-${caseId}`,
      documentType: 'CASE_APPOINTMENT',
      caseId,
      trusteeId: task.trusteeId,
      assignedOn: '2026-10-15T00:00:00.000Z',
      appointedDate: '2026-10-15',
      chapter: task.tuple.chapter,
      courtId: task.tuple.courtId,
      courtDivisionCode: task.tuple.divisionCode,
      ...(task.trusteeId === T_PARTIAL && [CLOSED_CASE, REASSIGNED_CASE].includes(caseId)
        ? { unassignedOn: '2026-11-01T00:00:00.000Z' }
        : {}),
      checks: {
        matchedCase: true,
        matchedTrustee: true,
        matchedTrusteeAppointment: task.status === 'approved',
        matchedBy: 'professional-id',
      },
      createdOn: task.createdOn,
      createdBy: SEEDER,
      updatedOn: task.createdOn,
      updatedBy: SEEDER,
    })),
  );

  const audit = {
    createdOn: SEEDED_ON,
    createdBy: SEEDER,
    updatedOn: SEEDED_ON,
    updatedBy: SEEDER,
  };
  const otherCaseAppointments = [
    // The reassigned case's current trustee: covered, so it belongs to no task.
    {
      id: `seed-case-appt-reassigned-to-${REASSIGNED_CASE}`,
      documentType: 'CASE_APPOINTMENT',
      caseId: REASSIGNED_CASE,
      trusteeId: T_REASSIGNED_TO,
      assignedOn: '2026-11-01T00:00:00.000Z',
      appointedDate: '2026-11-01',
      chapter: '7',
      courtId: DELAWARE.courtId,
      courtDivisionCode: DELAWARE.divisionCode,
      checks: {
        matchedCase: true,
        matchedTrustee: true,
        matchedTrusteeAppointment: true,
        matchedBy: 'professional-id',
      },
      ...audit,
    },
    // A placeholder (the trustee was not identified): never joins a task.
    {
      id: `seed-case-appt-placeholder-${PLACEHOLDER_CASES.caseIds[0]}`,
      documentType: 'CASE_APPOINTMENT',
      caseId: PLACEHOLDER_CASES.caseIds[0],
      trusteeId: 'seed-placeholder-fingerprint-appt',
      assignedOn: '2026-10-15T00:00:00.000Z',
      appointedDate: '2026-10-15',
      isSurrogate: true,
      chapter: '7',
      courtId: MANHATTAN.courtId,
      courtDivisionCode: MANHATTAN.divisionCode,
      checks: {
        matchedCase: true,
        matchedTrustee: false,
        matchedTrusteeAppointment: false,
        matchedBy: 'identity-task',
      },
      ...audit,
    },
    // A parked record (its case is not in CAMS yet): never joins a task. The trustee has no
    // covering appointment, so it would open one if it were attached today.
    {
      id: 'seed-case-appt-parked-081-99-90001',
      documentType: 'CASE_APPOINTMENT_UNATTACHED',
      caseId: '081-99-90001',
      trusteeId: T_NONE,
      assignedOn: '2026-11-09T00:00:00.000Z',
      appointedDate: '2026-11-09',
      chapter: '7',
      courtId: MANHATTAN.courtId,
      courtDivisionCode: MANHATTAN.divisionCode,
      checks: {
        matchedCase: false,
        matchedTrustee: true,
        matchedTrusteeAppointment: false,
        matchedBy: 'professional-id',
      },
      ...audit,
    },
  ];
  const identityTasks = IDENTITY_TASKS.map((task) => ({
    id: `seed-match-appt-${task.slug}`,
    ...identityTaskFields(task.key),
    caseId: task.caseId,
    courtId: task.court.courtId,
    status: 'pending',
    taskDate: task.taskDate,
    updatedOn: SEEDED_ON,
    updatedBy: SEEDER,
  }));
  const identityTaskSurrogates = IDENTITY_TASKS.map((task, index) =>
    buildSurrogate({
      slug: `appt-${task.slug}`,
      caseId: task.caseId,
      fingerprint: identityTasks[index].fingerprint,
      chapter: task.chapter,
      courtId: task.court.courtId,
      courtDivisionCode: task.court.divisionCode,
      appointedDate: '2026-11-01',
    }),
  );

  const caseAppointments = [
    ...taskCaseAppointments,
    ...otherCaseAppointments,
    ...identityTaskSurrogates,
  ];

  return [
    // DXTR rows first (case, debtor, petition), then the Cosmos cases they back (the runner orders them the same way).
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      insertOnly: true,
      data: GENERATED_DXTR_CASES,
    },
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      insertOnly: true,
      data: GENERATED_DXTR_DEBTORS,
    },
    {
      db: 'dxtr',
      collectionOrTable: 'AO_TX',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'TX_TYPE', 'TX_CODE'],
      insertOnly: true,
      data: GENERATED_DXTR_PETITIONS,
    },
    { db: 'cams', collectionOrTable: 'cases', data: GENERATED_CASES },
    { db: 'cams', collectionOrTable: 'trustees', data: trustees },
    { db: 'cams', collectionOrTable: 'trustee-appointments', data: appointments },
    // Dual-written to both partitions (case and trustee), as the repository does.
    { db: 'cams', collectionOrTable: 'case-trustee-appointments', data: caseAppointments },
    { db: 'cams', collectionOrTable: 'trustee-case-appointments', data: caseAppointments },
    { db: 'cams', collectionOrTable: 'trustee-appointment-verification', data: tasks },
    { db: 'cams', collectionOrTable: 'trustee-match-verification', data: identityTasks },
  ];
}
