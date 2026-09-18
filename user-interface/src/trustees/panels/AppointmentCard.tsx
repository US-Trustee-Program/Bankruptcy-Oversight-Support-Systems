import './AppointmentCard.scss';
import { useEffect, useState } from 'react';
import UpcomingKeyDates from './UpcomingKeyDates';
import PastKeyDates from './PastKeyDates';
import InfoCard from './InfoCard';
import Chapter13StandingAppointmentBody from './Chapter13StandingAppointmentBody';
import { UpcomingKeyDatesVariant } from './upcomingKeyDatesFieldConfig';
import { PastKeyDatesVariant } from './pastKeyDatesFieldConfig';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { formatAppointmentDate } from './appointmentDateFormat';
import { useNavigate } from 'react-router-dom';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
  DISPLAY_CHPT11_SUBV_PAST_KEY_DATES,
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  DISPLAY_CHPT12_STANDING_KEY_DATES,
  DISPLAY_CHPT13_STANDING_KEY_DATES,
  DISPLAY_CHPT7_ELECTED_KEY_DATES,
  TPR_DISPLAY_UPDATES,
} from '@/lib/hooks/UseFeatureFlags';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import Api2 from '@/lib/models/api2';
import {
  isChapter12Standing,
  isChapter13Standing,
  isChapter7Elected,
} from '@common/cams/trustee-appointments';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
  /** Only used for Chapter 13 Standing appointments, wired via an ancestor AccordionGroup. */
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
}

/**
 * Resolves which generic Upcoming/Past key-dates cards (if any) an appointment variant shows.
 * Chapter 13 Standing is handled separately by Chapter13StandingAppointmentBody.
 */
function resolveStandardKeyDatesVariants(flags: {
  showsChpt7KeyDatesCards: boolean;
  showsSubVPastKeyDatesCard: boolean;
  showsCh1213UpcomingKeyDatesCard: boolean;
  showsChpt12StandingKeyDatesCards: boolean;
  showsChpt7ElectedKeyDatesCards: boolean;
}): { upcoming: UpcomingKeyDatesVariant | null; past: PastKeyDatesVariant | null } {
  if (flags.showsChpt7KeyDatesCards) {
    return { upcoming: 'chapter7-panel', past: 'chapter7-panel' };
  }
  if (flags.showsSubVPastKeyDatesCard) {
    return { upcoming: null, past: 'subv-pool' };
  }
  if (flags.showsCh1213UpcomingKeyDatesCard) {
    return { upcoming: 'ch12-13-case-by-case', past: null };
  }
  if (flags.showsChpt12StandingKeyDatesCards) {
    return { upcoming: 'chapter12-standing', past: 'chapter12-standing' };
  }
  if (flags.showsChpt7ElectedKeyDatesCards) {
    return { upcoming: 'chapter7-elected', past: 'chapter7-elected' };
  }
  return { upcoming: null, past: null };
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
  const displayChpt7ElectedKeyDates = featureFlags[DISPLAY_CHPT7_ELECTED_KEY_DATES] === true;
  const tprDisplayUpdates = !!featureFlags[TPR_DISPLAY_UPDATES];
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
  const isChapter12StandingAppointment = isChapter12Standing(
    props.appointment.chapter,
    props.appointment.appointmentType,
  );
  const isChapter13StandingAppointment = isChapter13Standing(chapter, appointmentType);
  const isElectedChapter7 = isChapter7Elected(chapter, appointmentType);

  const showsChpt7KeyDatesCards = displayChpt7PanelUpcomingKeyDates && isPanelChapter7 && canManage;
  const showsSubVPastKeyDatesCard = displayChpt11SubVPastKeyDates && isSubVPool;
  const showsCh1213UpcomingKeyDatesCard =
    displayChpt1213CaseByCaseUpcomingKeyDates && isCh1213CaseByCase;
  const showsChpt12StandingKeyDatesCards =
    displayChpt12StandingKeyDates && isChapter12StandingAppointment;
  const showsChpt13StandingUpcomingKeyDates =
    displayChpt13StandingKeyDates && isChapter13StandingAppointment;
  const showsChpt7ElectedKeyDatesCards = displayChpt7ElectedKeyDates && isElectedChapter7;
  const shouldFetchKeyDates =
    showsChpt7KeyDatesCards ||
    showsSubVPastKeyDatesCard ||
    showsCh1213UpcomingKeyDatesCard ||
    showsChpt12StandingKeyDatesCards ||
    showsChpt13StandingUpcomingKeyDates ||
    showsChpt7ElectedKeyDatesCards;

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

  if (showsChpt13StandingUpcomingKeyDates) {
    return (
      <Chapter13StandingAppointmentBody
        appointment={props.appointment}
        keyDatesData={keyDatesData}
        isKeyDatesLoading={isKeyDatesLoading}
        expandedId={props.expandedId}
        onExpand={props.onExpand}
        onCollapse={props.onCollapse}
      />
    );
  }

  const { upcoming: upcomingVariant, past: pastVariant } = resolveStandardKeyDatesVariants({
    showsChpt7KeyDatesCards,
    showsSubVPastKeyDatesCard,
    showsCh1213UpcomingKeyDatesCard,
    showsChpt12StandingKeyDatesCards,
    showsChpt7ElectedKeyDatesCards,
  });

  const commonKeyDatesProps = {
    trusteeId: props.appointment.trusteeId,
    appointmentId: props.appointment.id,
    appointmentHeading,
    data: keyDatesData,
    isLoading: isKeyDatesLoading,
  };

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
        {upcomingVariant && (
          <UpcomingKeyDates
            variant={upcomingVariant}
            {...commonKeyDatesProps}
            tprDisplayUpdates={tprDisplayUpdates}
          />
        )}
        {pastVariant && <PastKeyDates variant={pastVariant} {...commonKeyDatesProps} />}
      </div>
    </div>
  );
}
