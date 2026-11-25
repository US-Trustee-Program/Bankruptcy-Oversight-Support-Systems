import { Trustee } from '@common/cams/trustees';
import {
  getDivisionCodes,
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '@common/cams/trustee-appointments';
import {
  TRUSTEE_APPOINTMENT_FIELDS,
  TrusteeAppointmentField,
  TrusteeDataDifference,
} from '@common/cams/trustee-data-report';
import { DivisionInfo, getAppointmentKey } from '../dataflows/trustee-load-rules';

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

/** The trustee's CAMS appointments by key, each key's in repository order. */
function groupByKey(
  trusteeId: string,
  appointments: TrusteeAppointment[],
): Map<string, TrusteeAppointment[]> {
  const groups = new Map<string, TrusteeAppointment[]>();
  for (const appointment of appointments) {
    const key = getAppointmentKey(trusteeId, appointment);
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  }
  return groups;
}

/**
 * The one of several CAMS appointments with a key that is compared with TOD: the active one, or
 * else the most recently appointed. CAMS merges appointments with a key only when both are active,
 * so an ended appointment and a later one can share a key.
 */
function toCompare(group: TrusteeAppointment[]): TrusteeAppointment {
  const active = group.find((appointment) => appointment.status === 'active');
  if (active) return active;
  return group.reduce((newest, appointment) =>
    fieldValue(appointment, 'appointedDate') > fieldValue(newest, 'appointedDate')
      ? appointment
      : newest,
  );
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
 * key, so a changed type is one appointment in TOD only and one in CAMS only. When CAMS holds
 * several appointments with one key, one is compared and the others are listed as in CAMS only.
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
  const camsByKey = groupByKey(trusteeId, camsAppointments);
  const row = (appointment: TrusteeAppointmentInput) => ({
    camsTrusteeId: trusteeId,
    todIds: [...todAppointmentsById.keys()],
    trusteeName: camsTrustee.name,
    appointment: identity(appointment),
  });

  const todOnly: TrusteeDataDifference[] = [...expected]
    .filter(([key]) => !camsByKey.has(key))
    .map(([, appointment]) => ({ kind: 'appointment-tod-only', ...row(appointment) }));

  const camsRows: TrusteeDataDifference[] = [...camsByKey].flatMap(([key, group]) => {
    const camsOnly = (appointment: TrusteeAppointment): TrusteeDataDifference => ({
      kind: 'appointment-cams-only',
      ...row(appointment),
    });
    const todAppointment = expected.get(key);
    if (!todAppointment) return group.map(camsOnly);

    const cams = toCompare(group);
    const others = group.filter((appointment) => appointment !== cams).map(camsOnly);

    const fieldRows: TrusteeDataDifference[] = TRUSTEE_APPOINTMENT_FIELDS.filter(
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

    return [...others, ...fieldRows, ...narrowedRows];
  });

  return [...todOnly, ...camsRows];
}
