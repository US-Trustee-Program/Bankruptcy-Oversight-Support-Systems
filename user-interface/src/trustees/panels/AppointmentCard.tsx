import './AppointmentCard.scss';
import UpcomingReportDates from './UpcomingReportDates';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import { useNavigate } from 'react-router-dom';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_REPORT_DATES,
} from '@/lib/hooks/UseFeatureFlags';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
}

const UNIX_EPOCH = '1970-01-01';

/**
 * Format appointment date with special handling for sentinel values.
 * Unix epoch (1970-01-01) is used as a sentinel value during ATS migration
 * to indicate dates that were not specified in the source system.
 */
function formatAppointmentDate(dateString: string): string {
  if (dateString.startsWith(UNIX_EPOCH)) {
    return 'Not Specified';
  }
  return formatDate(dateString);
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const featureFlags = useFeatureFlags();
  const displayChpt7PanelUpcomingReportDates =
    featureFlags[DISPLAY_CHPT7_PANEL_UPCOMING_REPORT_DATES] === true;
  const { chapter, appointmentType } = props.appointment;
  const formattedChapter = formatChapterType(chapter);
  const formattedAppointmentType = formatAppointmentType(appointmentType);

  // Build district display with guards for missing data
  // Use court name (e.g., "Eastern District of Missouri") populated by backend enrichment
  // Only fallback to court ID if court name is not available
  let districtDisplay: string;
  if (props.appointment.courtName) {
    districtDisplay = props.appointment.courtName;
  } else if (props.appointment.courtId) {
    // Fallback to court ID if court name is not available
    districtDisplay = `Court ${props.appointment.courtId}`;
  } else {
    districtDisplay = 'Court information not available';
  }

  const formattedEffectiveDate = formatAppointmentDate(props.appointment.effectiveDate);
  const formattedAppointedDate = formatAppointmentDate(props.appointment.appointedDate);
  const formattedStatus = formatAppointmentStatus(props.appointment.status);

  function openEditTrustee() {
    navigate(`/trustees/${props.appointment.trusteeId}/appointments/${props.appointment.id}/edit`);
  }

  const appointmentCardHeaderText = `${districtDisplay}: Chapter ${formattedChapter} - ${formattedAppointmentType}`;

  let appointmentHeading = districtDisplay;
  if (props.appointment.courtDivisionName) {
    appointmentHeading += ` (${props.appointment.courtDivisionName})`;
  }
  appointmentHeading += ` - Chapter ${formattedChapter} ${formattedAppointmentType}`;

  const isPanelChapter7 =
    props.appointment.chapter === '7' && props.appointment.appointmentType === 'panel';

  return (
    <div className="appointment-card-container">
      <h3 className="appointment-card-heading">{appointmentCardHeaderText}</h3>
      <div className="appointment-cards-row">
        <div className="appointment-card usa-card">
          <div className="usa-card__container">
            <div className="usa-card__body">
              <div className="appointment-card-header">
                <h4>Key Information</h4>
                {canManage && (
                  <Button
                    id="edit-trustee-appointment"
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    aria-label="Edit trustee appointment"
                    title="Edit trustee appointment"
                    onClick={openEditTrustee}
                  >
                    <IconLabel icon="edit" label="Edit" />
                  </Button>
                )}
              </div>
              <ul className="appointment-details-list">
                <li>
                  <span className="appointment-label">District:</span> {districtDisplay}
                </li>
                <li>
                  <span className="appointment-label">Chapter:</span> {formattedChapter}
                </li>
                <li>
                  <span className="appointment-label">Type:</span> {formattedAppointmentType}
                </li>
                <li>
                  <span className="appointment-label">Appointed:</span> {formattedAppointedDate}
                </li>
                <li>
                  <span className="appointment-label">Status:</span> {formattedStatus}
                </li>
                <li>
                  <span className="appointment-label">Status Effective:</span>{' '}
                  {formattedEffectiveDate}
                </li>
              </ul>
            </div>
          </div>
        </div>
        {displayChpt7PanelUpcomingReportDates && isPanelChapter7 && canManage && (
          <UpcomingReportDates
            trusteeId={props.appointment.trusteeId}
            appointmentId={props.appointment.id}
            appointmentHeading={appointmentHeading}
          />
        )}
      </div>
    </div>
  );
}
