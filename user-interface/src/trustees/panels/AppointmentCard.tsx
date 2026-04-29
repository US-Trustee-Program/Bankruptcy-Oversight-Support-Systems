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
import { useState, useEffect } from 'react';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';
import { getDivisionsForDistrict } from '@/lib/utils/court-utils';

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

  const [allCourts, setAllCourts] = useState<CourtDivisionDetails[]>([]);

  // Load courts data for division name lookup
  useEffect(() => {
    const loadCourts = async () => {
      try {
        const response = await Api2.getCourts();
        setAllCourts(response.data);
      } catch (err) {
        console.error('Error loading courts:', err);
      }
    };

    loadCourts();
  }, []);

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

  // Build divisions display
  // Backend may return divisionCodes array or legacy single divisionCode
  // Enrich on frontend by looking up division names from codes
  let divisionsDisplay = 'Not specified';

  if (props.appointment.divisionCodes && props.appointment.divisionCodes.length > 0) {
    // New format: array of division codes
    if (props.appointment.courtId && allCourts.length > 0) {
      const divisions = getDivisionsForDistrict(allCourts, props.appointment.courtId);
      const allDivisionCodes = divisions.map((d) => d.courtDivisionCode);

      // Check if all divisions are selected
      const hasAllDivisions =
        props.appointment.divisionCodes.length === allDivisionCodes.length &&
        props.appointment.divisionCodes.every((code) => allDivisionCodes.includes(code));

      if (hasAllDivisions) {
        divisionsDisplay = 'All';
      } else {
        // Look up names for each code
        const divisionNames = props.appointment.divisionCodes
          .map((code) => {
            const division = divisions.find((d) => d.courtDivisionCode === code);
            return division?.courtDivisionName || code;
          })
          .sort();
        divisionsDisplay = divisionNames.join(', ');
      }
    } else {
      // Can't look up names - show codes
      divisionsDisplay = props.appointment.divisionCodes.join(', ');
    }
  } else if (props.appointment.courtDivisionName) {
    // Backend provided the enriched name (legacy single division)
    divisionsDisplay = props.appointment.courtDivisionName;
  } else if (props.appointment.divisionCode && props.appointment.courtId && allCourts.length > 0) {
    // Look up the division name from the code (legacy single division)
    const divisions = getDivisionsForDistrict(allCourts, props.appointment.courtId);
    const division = divisions.find((d) => d.courtDivisionCode === props.appointment.divisionCode);
    divisionsDisplay = division?.courtDivisionName || props.appointment.divisionCode;
  } else if (props.appointment.divisionCode) {
    // Have code but can't look up name - show code (legacy single division)
    divisionsDisplay = props.appointment.divisionCode;
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
            { label: 'Divisions', value: divisionsDisplay },
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
