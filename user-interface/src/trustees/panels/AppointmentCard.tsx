import './AppointmentCard.scss';
import { useEffect, useState } from 'react';
import UpcomingKeyDates from './UpcomingKeyDates';
import PastKeyDates from './PastKeyDates';
import InfoCard from './InfoCard';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { formatDate } from '@/lib/utils/datetime';
import { useNavigate } from 'react-router-dom';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
  DISPLAY_CHPT11_SUBV_PAST_KEY_DATES,
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  DISPLAY_CHPT12_STANDING_KEY_DATES,
  DISPLAY_CHPT13_STANDING_KEY_DATES,
} from '@/lib/hooks/UseFeatureFlags';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import Api2 from '@/lib/models/api2';
import { isChapter12Standing } from '@common/cams/trustee-appointments';

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
  const displayChpt11SubVPastKeyDates = featureFlags[DISPLAY_CHPT11_SUBV_PAST_KEY_DATES] === true;
  const displayChpt1213CaseByCaseUpcomingKeyDates =
    featureFlags[DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES] === true;
  const displayChpt12StandingKeyDates = featureFlags[DISPLAY_CHPT12_STANDING_KEY_DATES] === true;
  const displayChpt13StandingKeyDates = featureFlags[DISPLAY_CHPT13_STANDING_KEY_DATES] === true;
  const { chapter, appointmentType } = props.appointment;
  const formattedChapter = formatChapterType(chapter);
  const formattedAppointmentType = formatAppointmentType(appointmentType);

  // Use shared courts hook to avoid redundant API calls
  const { courts: allCourts, error: courtsError } = useCourts();

  if (courtsError) {
    console.error('Error loading courts:', courtsError);
  }

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

  const divisionsDisplay = buildDivisionsDisplay(props.appointment, allCourts);

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
  const isSubVPool =
    props.appointment.chapter === '11-subchapter-v' && props.appointment.appointmentType === 'pool';
  const isCh1213CaseByCase =
    (props.appointment.chapter === '12' || props.appointment.chapter === '13') &&
    props.appointment.appointmentType === 'case-by-case';
  const isStandingChapter12 = isChapter12Standing(
    props.appointment.chapter,
    props.appointment.appointmentType,
  );
  const isChapter13Standing = chapter === '13' && appointmentType === 'standing';

  const showsChpt7KeyDatesCards = displayChpt7PanelUpcomingKeyDates && isPanelChapter7 && canManage;
  const showsSubVPastKeyDatesCard = displayChpt11SubVPastKeyDates && isSubVPool;
  const showsCh1213UpcomingKeyDatesCard =
    displayChpt1213CaseByCaseUpcomingKeyDates && isCh1213CaseByCase;
  const showsChpt12StandingKeyDatesCards = displayChpt12StandingKeyDates && isStandingChapter12;
  const showsChpt13StandingUpcomingKeyDates = displayChpt13StandingKeyDates && isChapter13Standing;
  const shouldFetchKeyDates =
    showsChpt7KeyDatesCards ||
    showsSubVPastKeyDatesCard ||
    showsCh1213UpcomingKeyDatesCard ||
    showsChpt12StandingKeyDatesCards ||
    showsChpt13StandingUpcomingKeyDates;

  const [keyDatesData, setKeyDatesData] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [isKeyDatesLoading, setIsKeyDatesLoading] = useState(shouldFetchKeyDates);

  useEffect(() => {
    if (!shouldFetchKeyDates) {
      return;
    }
    setIsKeyDatesLoading(true);
    Api2.getUpcomingKeyDates(props.appointment.trusteeId, props.appointment.id)
      .then((response) => {
        setKeyDatesData(response.data);
      })
      .catch((error) => {
        console.error('Could not load upcoming key dates', error);
        setKeyDatesData(null);
      })
      .finally(() => {
        setIsKeyDatesLoading(false);
      });
  }, [props.appointment.trusteeId, props.appointment.id, shouldFetchKeyDates]);

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
        {showsChpt7KeyDatesCards && (
          <>
            <UpcomingKeyDates
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
            <PastKeyDates
              variant="chapter7-panel"
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
          </>
        )}
        {showsSubVPastKeyDatesCard && (
          <PastKeyDates
            variant="subv-pool"
            trusteeId={props.appointment.trusteeId}
            appointmentId={props.appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDatesData}
            isLoading={isKeyDatesLoading}
          />
        )}
        {showsCh1213UpcomingKeyDatesCard && (
          <UpcomingKeyDates
            variant="ch12-13-case-by-case"
            trusteeId={props.appointment.trusteeId}
            appointmentId={props.appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDatesData}
            isLoading={isKeyDatesLoading}
          />
        )}
        {showsChpt12StandingKeyDatesCards && (
          <>
            <UpcomingKeyDates
              variant="chapter12-standing"
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
            <PastKeyDates
              variant="chapter12-standing"
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
          </>
        )}
        {showsChpt13StandingUpcomingKeyDates && (
          <>
            <UpcomingKeyDates
              variant="chapter13-standing"
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
            <PastKeyDates
              variant="chapter13-standing"
              trusteeId={props.appointment.trusteeId}
              appointmentId={props.appointment.id}
              appointmentHeading={appointmentHeading}
              data={keyDatesData}
              isLoading={isKeyDatesLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}
