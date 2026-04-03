import './AppointmentCard.scss';
import UpcomingKeyDates from './UpcomingKeyDates';
import PastKeyDates from './PastKeyDates';
import InfoCard from './InfoCard';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import { useNavigate } from 'react-router-dom';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
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
  const displayChpt7PanelUpcomingKeyDates =
    featureFlags[DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES] === true;
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
        <InfoCard
          id="edit-trustee-appointment"
          title="Key Information"
          onEdit={canManage ? openEditTrustee : undefined}
          editAriaLabel="Edit trustee appointment"
          editTitle="Edit trustee appointment"
          fields={[
            { label: 'District', value: districtDisplay },
            { label: 'Chapter', value: formattedChapter },
            { label: 'Type', value: formattedAppointmentType },
            { label: 'Appointed', value: formattedAppointedDate },
            { label: 'Status', value: formattedStatus },
            { label: 'Status Effective', value: formattedEffectiveDate },
          ]}
        />
        {displayChpt7PanelUpcomingKeyDates && isPanelChapter7 && canManage && (
          <>
            <UpcomingKeyDates
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
            />
            <PastKeyDates
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
            />
          </>
        )}
      </div>
    </div>
  );
}
