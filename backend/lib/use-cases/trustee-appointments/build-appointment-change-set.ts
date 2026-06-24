import { TrusteeChangeSet, TrusteeChangeField } from '@common/cams/notifications';
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

export function buildAppointmentChangeSet(params: {
  trusteeId: string;
  trusteeName: string;
  before?: AppointmentFieldSnapshot;
  after: AppointmentFieldSnapshot;
  courtNameResolver?: (courtId: string) => string | undefined;
}): TrusteeChangeSet {
  const { trusteeId, trusteeName, before, after, courtNameResolver } = params;
  const fields: TrusteeChangeField[] = [];

  const beforeChapter = before ? formatChapterType(before.chapter) : '';
  const afterChapter = formatChapterType(after.chapter);
  if (beforeChapter !== afterChapter) {
    fields.push({
      label: 'Chapter',
      before: beforeChapter,
      after: afterChapter,
      category: 'profile',
      section: 'appointment',
    });
  }

  const beforeType = before ? formatAppointmentType(before.appointmentType) : '';
  const afterType = formatAppointmentType(after.appointmentType);
  if (beforeType !== afterType) {
    fields.push({
      label: 'Appointment Type',
      before: beforeType,
      after: afterType,
      category: 'profile',
      section: 'appointment',
    });
  }

  const resolveCourtName = courtNameResolver ?? ((id: string) => id);
  const beforeCourt = before ? (resolveCourtName(before.courtId) ?? before.courtId) : '';
  const afterCourt = resolveCourtName(after.courtId) ?? after.courtId;
  if (beforeCourt !== afterCourt) {
    fields.push({
      label: 'District',
      before: beforeCourt,
      after: afterCourt,
      category: 'profile',
      section: 'appointment',
    });
  }

  const beforeDivisions = before?.divisionCodes?.join(', ') ?? '';
  const afterDivisions = after.divisionCodes?.join(', ') ?? '';
  if (beforeDivisions !== afterDivisions) {
    fields.push({
      label: 'Division',
      before: beforeDivisions,
      after: afterDivisions,
      category: 'profile',
      section: 'appointment',
      stackValues: true,
    });
  }

  const beforeDate = before?.appointedDate ?? '';
  const afterDate = after.appointedDate;
  if (beforeDate !== afterDate) {
    fields.push({
      label: 'Appointed Date',
      before: beforeDate,
      after: afterDate,
      category: 'profile',
      section: 'appointment',
    });
  }

  const beforeStatus = before ? formatAppointmentStatus(before.status) : '';
  const afterStatus = formatAppointmentStatus(after.status);
  if (beforeStatus !== afterStatus) {
    fields.push({
      label: 'Status',
      before: beforeStatus,
      after: afterStatus,
      category: 'profile',
      section: 'appointment',
    });
  }

  const beforeEffective = before?.effectiveDate ?? '';
  const afterEffective = after.effectiveDate;
  if (beforeEffective !== afterEffective) {
    fields.push({
      label: 'Status Effective Date',
      before: beforeEffective,
      after: afterEffective,
      category: 'profile',
      section: 'appointment',
    });
  }

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
    primaryChapter: after.chapter,
    subjectOverride,
  };
}
