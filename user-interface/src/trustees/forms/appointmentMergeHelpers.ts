import { getDivisionsForDistrict } from '@/lib/utils/court-utils';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  TrusteeAppointment,
  TrusteeAppointmentInput,
  buildMergePayload,
  findMergeTarget,
} from '@common/cams/trustee-appointments';

export { findMergeTarget };

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
 * Determine whether to merge into an existing appointment or create a new one, for display
 * in the appointment form's UX (e.g. "Updated existing appointment to include X"). The
 * duplicate-detection and division-merge logic itself lives in
 * common/src/cams/trustee-appointments.ts (buildMergePayload) so the backend can enforce the
 * identical rule -- this wrapper only adds human-readable division names, which needs a
 * district's full division list and has no backend equivalent.
 */
export function buildMergeResult(
  mergeTarget: TrusteeAppointment | undefined,
  payload: TrusteeAppointmentInput,
  allCourts: CourtDivisionDetails[],
): MergeResult {
  const result = buildMergePayload(mergeTarget, payload);
  if (result.type === 'created') {
    return result;
  }

  const divisions = getDivisionsForDistrict(allCourts, payload.courtId);
  const addedNames = result.addedDivisionCodes.map((code) => {
    const div = divisions.find((d) => d.courtDivisionCode === code);
    return div?.courtDivisionName ?? code;
  });

  return {
    type: 'merged',
    targetId: result.targetId,
    payload: result.payload,
    addedNames,
  };
}
