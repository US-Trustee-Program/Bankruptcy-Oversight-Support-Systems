import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import {
  CaseAppointmentChecks,
  CaseAppointmentDocumentType,
  hasAppointmentForCase,
  isAppointmentMatch,
  scoreAppointmentAgreement,
  TrusteeAppointment,
} from '@common/cams/trustee-appointments';
import {
  AppointmentTaskReason,
  TrusteeAppointmentRefreshResult,
  TrusteeAppointmentVerification,
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { OrderStatus } from '@common/cams/orders';
import { CourtsUseCase } from '../courts/courts';
import { TrusteeAppointmentsUseCase } from '../trustee-appointments/trustee-appointments';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-VERIFICATION-USE-CASE';
const APPOINTMENT_TASK_STATUSES: OrderStatus[] = ['pending', 'approved'];

type AppointmentTaskListParams = {
  statusParam?: string;
};

/** The case-appointment write a caller just made, as far as the appointment-task rule needs it. */
export type AppointmentTaskWrite = {
  caseId: string;
  trusteeId: string;
  courtId?: string;
  courtDivisionCode?: string;
  chapter?: string;
  unassignedOn?: string;
  documentType: CaseAppointmentDocumentType;
  checks?: CaseAppointmentChecks;
};

type AppointmentTaskCandidate = AppointmentTaskWrite & {
  courtId: string;
  courtDivisionCode: string;
  chapter: string;
  checks: CaseAppointmentChecks;
};

/**
 * The appointment-task predicate: an open (no unassignedOn), attached (CASE_APPOINTMENT) write
 * whose case and trustee were both identified, that no active appointment covers, with court,
 * division and chapter all present. A closed appointment is excluded because a task asserts the
 * trustee serves the case now; a historical appointment is not something a verifier can resolve.
 * Exported so a caller can skip fetching the trustee's appointments when no task applies.
 */
export function isAppointmentTaskCandidate(
  appointment: AppointmentTaskWrite,
): appointment is AppointmentTaskCandidate {
  const { courtId, courtDivisionCode, chapter, unassignedOn, documentType, checks } = appointment;
  return (
    documentType === 'CASE_APPOINTMENT' &&
    !unassignedOn &&
    !!checks?.matchedCase &&
    checks.matchedTrustee &&
    !checks.matchedTrusteeAppointment &&
    !!courtId &&
    !!courtDivisionCode &&
    !!chapter
  );
}

/**
 * CAMS-956: an attached case appointment whose case and trustee were both identified, but whose
 * trustee holds no active appointment covering the case's court, division and chapter, belongs to
 * a "Trustee Appointment" task for that (trustee, court, division, chapter). Every site that
 * writes a case appointment calls this right after its write; the repository's atomic upsert
 * makes repeat calls for the same case a no-op.
 *
 * Does nothing unless isAppointmentTaskCandidate holds.
 *
 * `trusteeAppointments` is the trustee's full appointment list, which every caller has already
 * fetched to compute checks. Errors propagate; the caller decides whether to retry.
 */
export async function openOrJoinAppointmentTask(
  context: ApplicationContext,
  appointment: AppointmentTaskWrite,
  trusteeAppointments: TrusteeAppointment[],
  user: CamsUserReference = SYSTEM_USER_REFERENCE,
): Promise<void> {
  if (!isAppointmentTaskCandidate(appointment)) return;
  const { caseId, trusteeId, courtId, courtDivisionCode, chapter } = appointment;

  const reason: AppointmentTaskReason = hasAppointmentForCase(
    trusteeAppointments,
    courtId,
    courtDivisionCode,
    chapter,
  )
    ? 'appointment-inactive'
    : 'no-appointment';

  await factory
    .getTrusteeAppointmentVerificationRepository(context)
    .openOrJoin(
      { trusteeId, courtId, divisionCode: courtDivisionCode, chapter },
      caseId,
      reason,
      user,
    );
}

/**
 * Resolves a task's (courtId, divisionCode) tuple against the courts list, the same way for the
 * queue row and the detail view: a name that can't be resolved is left out rather than guessed.
 */
function resolveTaskCourtNames(
  task: Pick<TrusteeAppointmentVerification, 'courtId' | 'divisionCode'>,
  courts: CourtDivisionDetails[],
): { courtName?: string; courtDivisionName?: string } {
  const division = courts.find(
    (c) => c.courtId === task.courtId && c.courtDivisionCode === task.divisionCode,
  );
  const courtName = (division ?? courts.find((c) => c.courtId === task.courtId))?.courtName;
  return {
    ...(courtName ? { courtName } : {}),
    ...(division ? { courtDivisionName: division.courtDivisionName } : {}),
  };
}

function toListItem(
  task: TrusteeAppointmentVerification,
  courts: CourtDivisionDetails[],
): TrusteeAppointmentVerificationListItem {
  const { courtName, courtDivisionName } = resolveTaskCourtNames(task, courts);
  return {
    id: task.id,
    documentType: task.documentType,
    taskType: task.taskType,
    trusteeId: task.trusteeId,
    courtId: task.courtId,
    ...(courtName ? { courtName } : {}),
    divisionCode: task.divisionCode,
    ...(courtDivisionName ? { courtDivisionName } : {}),
    chapter: task.chapter,
    reason: task.reason,
    status: task.status,
    taskDate: task.createdOn,
    caseCount: task.caseIds.length,
  };
}

/**
 * Appointment tasks for the Data Verification queue, filtered by statusParam: a comma-separated
 * list of statuses from APPOINTMENT_TASK_STATUSES, parsed the same way as trustee-match
 * verifications. Unknown names are dropped. With no statusParam, only pending tasks are returned.
 * When a non-empty statusParam leaves no valid status, the result is an empty list and the
 * repository is not queried. Court and division names are resolved from the courts list and are
 * left out when they cannot be resolved.
 */
export async function listAppointmentTasks(
  context: ApplicationContext,
  params: AppointmentTaskListParams = {},
): Promise<TrusteeAppointmentVerificationListItem[]> {
  const parsedStatuses = (params.statusParam ?? '')
    .split(',')
    .map((s) => s.trim() as OrderStatus)
    .filter((s) => APPOINTMENT_TASK_STATUSES.includes(s));

  if (params.statusParam && parsedStatuses.length === 0) {
    return [];
  }

  const status: OrderStatus[] = parsedStatuses.length > 0 ? parsedStatuses : ['pending'];
  const tasks = await factory
    .getTrusteeAppointmentVerificationRepository(context)
    .search({ status });
  const courts = await new CourtsUseCase().getCourts(context);
  return tasks.map((task) => toListItem(task, courts));
}

/**
 * One appointment task's full detail (CAMS-956), fetched when a data verifier expands its
 * row: court/division names resolved the same way as the queue row, plus the trustee's full
 * appointment list scored and sorted by how closely each one agrees with the task's (court,
 * division, chapter) tuple -- closest agreement first, ties broken by the most recently appointed.
 * trusteeId is the collection's shard key, so the task is looked up within that trustee.
 * Propagates a not-found error from the repository when the task does not exist.
 */
export async function getAppointmentTaskDetail(
  context: ApplicationContext,
  id: string,
  trusteeId: string,
): Promise<TrusteeAppointmentVerificationDetail> {
  const [task, courts, trustee] = await Promise.all([
    factory.getTrusteeAppointmentVerificationRepository(context).findById(id, trusteeId),
    new CourtsUseCase().getCourts(context),
    factory.getTrusteesRepository(context).read(trusteeId),
  ]);
  const trusteeAppointments = await new TrusteeAppointmentsUseCase(context).getTrusteeAppointments(
    context,
    trusteeId,
    courts,
  );
  const trusteeName = trustee.name;

  const appointments = trusteeAppointments
    .map((appointment) => ({
      ...appointment,
      agreement: scoreAppointmentAgreement(
        appointment,
        task.courtId,
        task.divisionCode,
        task.chapter,
      ),
    }))
    .sort(
      (a, b) =>
        b.agreement.score - a.agreement.score || b.appointedDate.localeCompare(a.appointedDate),
    );

  return {
    ...task,
    ...resolveTaskCourtNames(task, courts),
    trusteeName,
    appointments,
  };
}

/**
 * Marks one case's current appointment as covered, if it still sits on the task's
 * (trustee, court, division, chapter). Returns whether the case counts toward the verified total.
 * A case whose active appointment is for another trustee, or for another court, division or
 * chapter (for example, the trustee was re-appointed to the case with a different tuple), is
 * skipped; so is a case with no active appointment. A case already marked covered (e.g. by an
 * earlier refresh that failed before resolving the task) counts without a rewrite.
 */
async function markCaseCovered(
  context: ApplicationContext,
  caseId: string,
  task: Pick<TrusteeAppointmentVerification, 'trusteeId' | 'courtId' | 'divisionCode' | 'chapter'>,
): Promise<boolean> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  const active = await repo.getActiveByCaseId(caseId);
  const onTaskTuple =
    active?.trusteeId === task.trusteeId &&
    active?.courtId === task.courtId &&
    active?.courtDivisionCode === task.divisionCode &&
    active?.chapter === task.chapter;
  // A case only joins a task through the task predicate, which requires checks; an appointment
  // without them is not the one that opened the task.
  if (!active?.checks || !onTaskTuple) return false;
  if (active.checks.matchedTrusteeAppointment) return true;
  await repo.updateCaseAppointment({
    ...active,
    checks: { ...active.checks, matchedTrusteeAppointment: true },
  });
  return true;
}

/**
 * A data verifier's "Refresh Trustee Appointments" on one appointment task.
 * Re-reads the trustee's appointments and applies the shared coverage rule (isAppointmentMatch)
 * to the task's (court, division, chapter). Every case in a task shares that tuple, so coverage is
 * all-or-nothing. If covered: marks each case whose active appointment still sits on this tuple
 * as covered, THEN resolves the task, so a failed case write leaves the task open and a retry is
 * safe. If not covered: changes nothing and reports the tuple for the verifier's warning.
 */
export async function refreshAppointmentTask(
  context: ApplicationContext,
  id: string,
  trusteeId: string,
): Promise<TrusteeAppointmentRefreshResult> {
  const taskRepo = factory.getTrusteeAppointmentVerificationRepository(context);
  const [task, courts, trustee] = await Promise.all([
    taskRepo.findById(id, trusteeId),
    new CourtsUseCase().getCourts(context),
    factory.getTrusteesRepository(context).read(trusteeId),
  ]);
  const trusteeAppointments = await new TrusteeAppointmentsUseCase(context).getTrusteeAppointments(
    context,
    trusteeId,
    courts,
  );

  if (!isAppointmentMatch(trusteeAppointments, task.courtId, task.divisionCode, task.chapter)) {
    return {
      outcome: 'still-uncovered',
      courtId: task.courtId,
      divisionCode: task.divisionCode,
      chapter: task.chapter,
      ...resolveTaskCourtNames(task, courts),
    };
  }

  let updatedCaseCount = 0;
  for (const caseId of task.caseIds) {
    if (await markCaseCovered(context, caseId, task)) updatedCaseCount++;
  }

  await taskRepo.resolve(id, trusteeId, getCamsUserReference(context.session.user));
  context.logger.info(
    MODULE_NAME,
    `Resolved trustee appointment task ${id} for trustee ${trusteeId}: ${updatedCaseCount} of ${task.caseIds.length} cases marked covered.`,
  );

  return {
    outcome: 'resolved',
    trusteeName: trustee.name,
    updatedCaseCount,
    task: toListItem({ ...task, status: 'approved' }, courts),
  };
}
