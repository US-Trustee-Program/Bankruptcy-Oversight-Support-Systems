import { Trustee } from '@common/cams/trustees';
import {
  getDivisionCodes,
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '@common/cams/trustee-appointments';
import { TrusteeAppointmentField, TrusteeDataDifference } from '@common/cams/trustee-data-report';
import { DivisionInfo, getAppointmentKey } from '../dataflows/migrate-trustees';

const APPOINTMENT_FIELDS: TrusteeAppointmentField[] = ['status', 'appointedDate', 'effectiveDate'];

function fieldValue(appointment: TrusteeAppointmentInput, field: TrusteeAppointmentField): string {
  const value = appointment[field];
  return field === 'status' ? value : value.slice(0, 10);
}

function identity(appointment: TrusteeAppointmentInput): TrusteeDataDifference['appointment'] {
  return {
    courtId: appointment.courtId,
    courtName: appointment.courtName,
    chapter: appointment.chapter,
    appointmentType: appointment.appointmentType,
  };
}

/**
 * The appointments the original load would have created for a trustee: those of every linked TOD
 * record, in truIds order, keeping the first appointment for each key, as the load did.
 */
function expectedAppointments(
  trusteeId: string,
  todAppointmentsById: Map<string, TrusteeAppointmentInput[]>,
): Map<string, TrusteeAppointmentInput> {
  const expected = new Map<string, TrusteeAppointmentInput>();
  for (const appointments of todAppointmentsById.values()) {
    for (const appointment of appointments) {
      const key = getAppointmentKey(trusteeId, appointment);
      if (!expected.has(key)) expected.set(key, appointment);
    }
  }
  return expected;
}

/** The district's division codes when the CAMS appointment covers only some of them. */
function narrowedFrom(
  appointment: TrusteeAppointment,
  districtToDivisions: Map<string, DivisionInfo[]>,
): string[] | undefined {
  const districtCodes = (districtToDivisions.get(appointment.courtId) ?? []).map(
    (division) => division.divisionCode,
  );
  const camsCodes = new Set(getDivisionCodes(appointment));
  const isStrictSubset =
    camsCodes.size > 0 &&
    camsCodes.size < districtCodes.length &&
    [...camsCodes].every((code) => districtCodes.includes(code));
  return isStrictSubset ? districtCodes : undefined;
}

/**
 * Compares one linked CAMS trustee's appointments with those the original load would have created
 * from its TOD records. Appointments match on district, chapter and appointment type, the load's
 * key, so a changed type is one appointment in TOD only and one in CAMS only.
 *
 * @param todAppointmentsById - clean TOD appointments for each linked TOD ID, in truIds order,
 * each ID's appointments in the order the load read them. Every linked ID has an entry.
 */
export function compareTrusteeAppointments(
  camsTrustee: Trustee,
  camsAppointments: TrusteeAppointment[],
  todAppointmentsById: Map<string, TrusteeAppointmentInput[]>,
  districtToDivisions: Map<string, DivisionInfo[]>,
): TrusteeDataDifference[] {
  const { trusteeId } = camsTrustee;
  const expected = expectedAppointments(trusteeId, todAppointmentsById);
  const camsByKey = new Map(
    camsAppointments.map((appointment) => [getAppointmentKey(trusteeId, appointment), appointment]),
  );
  const row = (appointment: TrusteeAppointmentInput) => ({
    camsTrusteeId: trusteeId,
    todIds: [...todAppointmentsById.keys()],
    trusteeName: camsTrustee.name,
    appointment: identity(appointment),
  });

  const todOnly: TrusteeDataDifference[] = [...expected]
    .filter(([key]) => !camsByKey.has(key))
    .map(([, appointment]) => ({ kind: 'appointment-tod-only', ...row(appointment) }));

  const camsRows: TrusteeDataDifference[] = [...camsByKey].flatMap(([key, cams]) => {
    const todAppointment = expected.get(key);
    if (!todAppointment) return [{ kind: 'appointment-cams-only', ...row(cams) }];

    const fieldRows: TrusteeDataDifference[] = APPOINTMENT_FIELDS.filter(
      (field) => fieldValue(cams, field) !== fieldValue(todAppointment, field),
    ).map((field) => ({
      kind: 'appointment-field',
      ...row(cams),
      field,
      camsValue: fieldValue(cams, field),
      todValue: fieldValue(todAppointment, field),
    }));

    const districtCodes = narrowedFrom(cams, districtToDivisions);
    const narrowedRows: TrusteeDataDifference[] = districtCodes
      ? [
          {
            kind: 'appointment-divisions-narrowed',
            ...row(cams),
            camsValue: getDivisionCodes(cams).join(', '),
            todValue: districtCodes.join(', '),
          },
        ]
      : [];

    return [...fieldRows, ...narrowedRows];
  });

  return [...todOnly, ...camsRows];
}
