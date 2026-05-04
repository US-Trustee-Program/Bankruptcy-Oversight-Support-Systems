import { getDivisionsForDistrict } from '@/lib/utils/court-utils';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AppointmentChapterType, AppointmentType } from '@common/cams/trustees';

type MergeResult =
  | {
      type: 'merged';
      targetId: string;
      payload: TrusteeAppointmentInput;
      addedNames: string[];
    }
  | {
      type: 'created';
    };

/**
 * Find a merge target among existing appointments.
 * A merge target is an active appointment with the same courtId, chapter, and appointmentType.
 */
export function findMergeTarget(
  courtId: string,
  chapter: AppointmentChapterType | string,
  appointmentType: AppointmentType | string,
  existingAppointments: TrusteeAppointment[],
): TrusteeAppointment | undefined {
  return existingAppointments.find(
    (appt) =>
      appt.courtId === courtId &&
      appt.chapter === chapter &&
      appt.appointmentType === appointmentType &&
      appt.status === 'active',
  );
}

/**
 * Determine whether to merge into an existing appointment or create a new one.
 * If a merge target exists, builds a merged payload with deduplicated division codes.
 */
export function buildMergeResult(
  mergeTarget: TrusteeAppointment | undefined,
  payload: TrusteeAppointmentInput,
  allCourts: CourtDivisionDetails[],
): MergeResult {
  if (!mergeTarget) {
    return { type: 'created' };
  }

  const existingDivisions = (mergeTarget.divisionCodes ?? [mergeTarget.divisionCode]).filter(
    Boolean,
  ) as string[];
  const mergedDivisions = [...new Set([...existingDivisions, ...payload.divisionCodes!])];
  const addedDivisions = payload.divisionCodes!.filter((code) => !existingDivisions.includes(code));

  const divisions = getDivisionsForDistrict(allCourts, payload.courtId);
  const addedNames = addedDivisions.map((code) => {
    const div = divisions.find((d) => d.courtDivisionCode === code);
    return div?.courtDivisionName ?? code;
  });

  return {
    type: 'merged',
    targetId: mergeTarget.id,
    payload: {
      ...payload,
      divisionCodes: mergedDivisions,
      divisionCode: mergedDivisions[0],
    },
    addedNames,
  };
}
