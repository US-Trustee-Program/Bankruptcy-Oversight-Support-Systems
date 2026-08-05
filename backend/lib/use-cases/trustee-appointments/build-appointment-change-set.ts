import { TrusteeChangeSet, TrusteeChangeField } from '@common/cams/notifications';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import {
  AppointmentChapterType,
  AppointmentType,
  AppointmentStatus,
  formatChapterType,
  formatAppointmentType,
} from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';

export type AppointmentFieldSnapshot = {
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
  courtId: string;
  divisionCodes?: string[];
  appointedDate: string;
  status: AppointmentStatus;
  effectiveDate: string;
};

function diffField(
  label: string,
  beforeValue: string,
  afterValue: string,
  options?: { stackValues?: boolean },
): TrusteeChangeField | undefined {
  if (beforeValue === afterValue) return undefined;
  return {
    label,
    comparisons: [{ before: beforeValue, after: afterValue }],
    category: 'profile',
    section: 'appointment',
    ...(options?.stackValues && { stackValues: true }),
  };
}

function isAllDivisions(divisionCodes: string[], allKnown: string[]): boolean {
  if (allKnown.length === 0) return false;
  return allKnown.every((code) => divisionCodes.includes(code));
}

function buildDistrictDivisionValue(
  courtId: string,
  divisionCodes: string[] | undefined,
  resolveCourtName: (id: string) => string | undefined,
  allKnownDivisions: string[],
): string {
  const district = resolveCourtName(courtId) ?? courtId;
  if (!divisionCodes || divisionCodes.length === 0) return district;
  if (isAllDivisions(divisionCodes, allKnownDivisions)) {
    return `${district} (All)`;
  }
  return divisionCodes
    .map((code) => `${district} (${USTP_OFFICE_NAME_MAP.get(code) ?? code})`)
    .join('\n');
}

export function buildAppointmentChangeSet(params: {
  trusteeId: string;
  trusteeName: string;
  before?: AppointmentFieldSnapshot;
  after: AppointmentFieldSnapshot;
  courtNameResolver: (courtId: string) => string | undefined;
  allDivisionsResolver: (courtId: string) => string[];
}): TrusteeChangeSet {
  const { trusteeId, trusteeName, before, after, courtNameResolver, allDivisionsResolver } = params;

  const candidates = [
    diffField(
      'Chapter',
      before ? formatChapterType(before.chapter) : '',
      formatChapterType(after.chapter),
    ),
    diffField(
      'Appointment Type',
      before ? formatAppointmentType(before.appointmentType) : '',
      formatAppointmentType(after.appointmentType),
    ),
    diffField(
      'District (Division)',
      before
        ? buildDistrictDivisionValue(
            before.courtId,
            before.divisionCodes,
            courtNameResolver,
            allDivisionsResolver(before.courtId),
          )
        : '',
      buildDistrictDivisionValue(
        after.courtId,
        after.divisionCodes,
        courtNameResolver,
        allDivisionsResolver(after.courtId),
      ),
      { stackValues: true },
    ),
    diffField('Appointed Date', before?.appointedDate ?? '', after.appointedDate),
    diffField(
      'Status',
      before ? formatAppointmentStatus(before.status) : '',
      formatAppointmentStatus(after.status),
    ),
    diffField('Status Effective Date', before?.effectiveDate ?? '', after.effectiveDate),
  ];

  const fields = candidates.filter((f): f is TrusteeChangeField => f !== undefined);

  const isCreate = !before;
  const subjectOverride = isCreate
    ? `New Trustee Appointment: ${trusteeName}`
    : fields.length > 0
      ? `Trustee Appointment Changed: ${trusteeName}`
      : undefined;

  return {
    trusteeId,
    trusteeName,
    fields,
    chapters: [after.chapter],
    subjectOverride,
  };
}
