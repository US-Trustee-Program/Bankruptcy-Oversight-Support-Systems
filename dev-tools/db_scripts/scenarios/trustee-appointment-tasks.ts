/**
 * Scenario: trustee-appointment-tasks
 * Database: cams only
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
 *      chapter or status (Manhattan Ch 15, 3 cases): 7 appointments, so the table paginates and
 *      shows warning icons. The same trustee also has task 3.
 *   3. Same trustee as task 2, a second tuple (Chicago Ch 15, 1 case): one trustee, two tasks.
 *   4. Appointment inactive (Buffalo Ch 12, 2 cases): the reason sentence for an inactive
 *      appointment.
 *   5. Ready to resolve (Chicago Ch 15, 3 cases): the trustee already holds an active covering
 *      appointment, so Refresh Trustee Appointments resolves the task and covers all 3 cases.
 *   6. Already resolved (Chicago Ch 15, 1 case): shown only when the queue includes approved tasks.
 *
 *   7. Many cases (Manhattan Ch 15, 12 cases): a long affected-case list.
 *   8. Unresolvable court names (court 0674 / division 674, Ch 12, 2 cases): the queue row and
 *      the subject fall back to the codes. Its trustee holds an active Ch 7 appointment there.
 *   9. Partial coverage (Chicago Ch 15, 3 cases): the trustee holds a covering appointment, but
 *      one case's appointment was closed and one was reassigned to another trustee, so Refresh
 *      covers only 1 of the 3 ("verified for 1 case").
 *  10. Records that must never join a task, seeded on the task-1 trustee: a placeholder
 *      (checks.matchedTrustee false) and a parked record (CASE_APPOINTMENT_UNATTACHED). Neither
 *      appears in any task's case list.
 *
 * The cases are existing seeded cases from cases-fuzzy-search.ts that no identity-task scenario
 * gives an appointment, so no DXTR seeding is needed.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const SEEDED_ON = '2026-11-10T00:00:00.000Z';

type Tuple = { courtId: string; divisionCode: string; chapter: string };

const BUFFALO = { courtId: '0209', divisionCode: '091' };
const BUFFALO_NAMES = {
  courtName: 'U.S. Bankruptcy Court Western District of New York',
  courtDivisionName: 'Buffalo',
};
const MANHATTAN = { courtId: '0208', divisionCode: '081' };
const MANHATTAN_NAMES = {
  courtName: 'U.S. Bankruptcy Court Southern District of New York',
  courtDivisionName: 'Manhattan',
};
const CHICAGO = { courtId: '0711', divisionCode: '111' };
const CHICAGO_NAMES = {
  courtName: 'U.S. Bankruptcy Court Northern District of Illinois',
  courtDivisionName: 'Chicago',
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
const CHICAGO_COURT = { ...CHICAGO, ...CHICAGO_NAMES };

const T_NONE = 'seed-trustee-appt-none';
const T_MISMATCH = 'seed-trustee-appt-mismatch';
const T_INACTIVE = 'seed-trustee-appt-inactive';
const T_READY = 'seed-trustee-appt-ready';
const T_RESOLVED = 'seed-trustee-appt-resolved';
const T_MANY = 'seed-trustee-appt-many';
const T_NAMELESS = 'seed-trustee-appt-nocourtname';
const T_PARTIAL = 'seed-trustee-appt-partial';
const T_REASSIGNED_TO = 'seed-trustee-appt-reassignedto';

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
    slug: 'mismatch-manhattan-15',
    trusteeId: T_MISMATCH,
    tuple: { ...MANHATTAN, chapter: '15' },
    reason: 'no-appointment',
    caseIds: ['081-26-63921', '081-87-50941', '081-27-10491'],
    status: 'pending',
    createdOn: '2026-11-08T14:00:00.000Z',
  },
  {
    slug: 'mismatch-chicago-15',
    trusteeId: T_MISMATCH,
    tuple: { ...CHICAGO, chapter: '15' },
    reason: 'no-appointment',
    caseIds: ['111-45-80671'],
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
    slug: 'ready-chicago-15',
    trusteeId: T_READY,
    tuple: { ...CHICAGO, chapter: '15' },
    reason: 'no-appointment',
    caseIds: ['111-30-07761', '111-90-62941', '111-12-39891'],
    status: 'pending',
    createdOn: '2026-11-06T14:00:00.000Z',
  },
  {
    slug: 'resolved-chicago-15',
    trusteeId: T_RESOLVED,
    tuple: { ...CHICAGO, chapter: '15' },
    reason: 'no-appointment',
    caseIds: ['111-83-76271'],
    status: 'approved',
    createdOn: '2026-11-03T14:00:00.000Z',
  },
  {
    slug: 'many-manhattan-15',
    trusteeId: T_MANY,
    tuple: { ...MANHATTAN, chapter: '15' },
    reason: 'no-appointment',
    caseIds: [
      '081-91-06221',
      '081-82-08111',
      '081-13-35011',
      '081-51-51841',
      '081-56-78971',
      '081-94-55601',
      '081-24-47791',
      '081-73-31081',
      '081-96-45961',
      '081-32-46421',
      '081-33-88951',
      '081-43-45611',
    ],
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
    slug: 'partial-chicago-15',
    trusteeId: T_PARTIAL,
    tuple: { ...CHICAGO, chapter: '15' },
    reason: 'no-appointment',
    caseIds: ['111-48-40001', '111-32-37881', '111-98-67871'],
    status: 'pending',
    createdOn: '2026-11-02T14:00:00.000Z',
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
  ];

  const appointments = [
    // T_NONE: deliberately none.

    // T_MISMATCH: seven appointments (a second page of the table), none covering Manhattan Ch 15
    // or Chicago Ch 15. Ordered in the table by how closely each agrees with the task's tuple.
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
      status: 'inactive',
      appointedDate: '2019-06-01',
    }),
    appointment({
      id: 'seed-appt-mismatch-4',
      trusteeId: T_MISMATCH,
      chapter: '15',
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
      court: CHICAGO_COURT,
      status: 'active',
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
      court: CHICAGO_COURT,
      status: 'resigned',
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
      status: 'inactive',
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

    // T_READY: an active appointment already covers Chicago Ch 15, so refreshing resolves the task.
    appointment({
      id: 'seed-appt-ready-1',
      trusteeId: T_READY,
      chapter: '15',
      appointmentType: 'case-by-case',
      court: CHICAGO_COURT,
      status: 'active',
      appointedDate: '2026-11-08',
    }),
    appointment({
      id: 'seed-appt-ready-2',
      trusteeId: T_READY,
      chapter: '7',
      appointmentType: 'panel',
      court: CHICAGO_COURT,
      status: 'active',
      appointedDate: '2020-01-01',
    }),

    // T_RESOLVED: covered, so its task was resolved.
    appointment({
      id: 'seed-appt-resolved-1',
      trusteeId: T_RESOLVED,
      chapter: '15',
      appointmentType: 'case-by-case',
      court: CHICAGO_COURT,
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
    // T_PARTIAL: covers Chicago Ch 15, so refreshing resolves the task, but only for the cases
    // still assigned to this trustee on the tuple.
    appointment({
      id: 'seed-appt-partial-1',
      trusteeId: T_PARTIAL,
      chapter: '15',
      appointmentType: 'case-by-case',
      court: CHICAGO_COURT,
      status: 'active',
      appointedDate: '2026-11-08',
    }),
    appointment({
      id: 'seed-appt-reassignedto-1',
      trusteeId: T_REASSIGNED_TO,
      chapter: '15',
      appointmentType: 'case-by-case',
      court: CHICAGO_COURT,
      status: 'active',
      appointedDate: '2026-11-01',
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
  const CLOSED_CASE = '111-32-37881';
  const REASSIGNED_CASE = '111-98-67871';
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
      chapter: '15',
      courtId: CHICAGO.courtId,
      courtDivisionCode: CHICAGO.divisionCode,
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
      id: 'seed-case-appt-placeholder-081-57-17261',
      documentType: 'CASE_APPOINTMENT',
      caseId: '081-57-17261',
      trusteeId: 'seed-placeholder-fingerprint-appt',
      assignedOn: '2026-10-15T00:00:00.000Z',
      appointedDate: '2026-10-15',
      isSurrogate: true,
      chapter: '15',
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
      chapter: '15',
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
  const caseAppointments = [...taskCaseAppointments, ...otherCaseAppointments];

  return [
    { db: 'cams', collectionOrTable: 'trustees', data: trustees },
    { db: 'cams', collectionOrTable: 'trustee-appointments', data: appointments },
    // Dual-written to both partitions (case and trustee), as the repository does.
    { db: 'cams', collectionOrTable: 'case-trustee-appointments', data: caseAppointments },
    { db: 'cams', collectionOrTable: 'trustee-case-appointments', data: caseAppointments },
    { db: 'cams', collectionOrTable: 'trustee-appointment-verification', data: tasks },
  ];
}
