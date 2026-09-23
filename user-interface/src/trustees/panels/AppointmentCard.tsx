import './AppointmentCard.scss';
import { useEffect, useState } from 'react';
import InfoCard from './InfoCard';
import Chapter13StandingAppointmentBody from './Chapter13StandingAppointmentBody';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import useEditTrusteeAppointment from '@/lib/hooks/UseEditTrusteeAppointment';
import useFeatureFlags, { DISPLAY_CHPT13_STANDING_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { isChapter13Standing } from '@common/cams/trustee-appointments';
import { formatAppointmentDate, buildDistrictDisplay } from './appointmentDisplay';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
  /** Only used for Chapter 13 Standing appointments, wired via an ancestor AccordionGroup. */
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const { canManage, openEditTrustee } = useEditTrusteeAppointment(props.appointment);

  const featureFlags = useFeatureFlags();
  const displayChpt13StandingKeyDates = featureFlags[DISPLAY_CHPT13_STANDING_KEY_DATES] === true;
  const { chapter, appointmentType } = props.appointment;
  const formattedChapter = formatChapterType(chapter);
  const formattedAppointmentType = formatAppointmentType(appointmentType);

  // Use shared courts hook to avoid redundant API calls
  const { courts: allCourts, error: courtsError } = useCourts();

  if (courtsError) {
    console.error('Error loading courts:', courtsError);
  }

  const districtDisplay = buildDistrictDisplay(props.appointment);

  const divisionsDisplay = buildDivisionsDisplay(props.appointment, allCourts);

  const formattedEffectiveDate = formatAppointmentDate(props.appointment.effectiveDate);
  const formattedAppointedDate = formatAppointmentDate(props.appointment.appointedDate);
  const formattedStatus = formatAppointmentStatus(props.appointment.status);

  const appointmentCardHeaderText = `${districtDisplay}: Chapter ${formattedChapter} - ${formattedAppointmentType}`;

  const isChapter13StandingAppointment = isChapter13Standing(chapter, appointmentType);

  const showsChpt13StandingUpcomingKeyDates =
    displayChpt13StandingKeyDates && isChapter13StandingAppointment;
  const shouldFetchKeyDates = showsChpt13StandingUpcomingKeyDates;

  // Chapter 13 Standing appointments are rendered inside a collapsible accordion; every other
  // variant renders its key-dates cards immediately, so it should fetch as soon as it mounts.
  // The accordion's expanded state is tracked locally (rather than solely from props.expandedId)
  // because Accordion's own visible state is driven by the onExpand/onCollapse click callbacks,
  // which fire even when a parent isn't relaying expandedId back down (e.g. standalone usage).
  const isAccordionGated = showsChpt13StandingUpcomingKeyDates;
  const [isAccordionOpen, setIsAccordionOpen] = useState(
    () => props.expandedId === props.appointment.id,
  );

  useEffect(() => {
    if (props.expandedId !== undefined) {
      setIsAccordionOpen(props.expandedId === props.appointment.id);
    }
  }, [props.expandedId, props.appointment.id]);

  function handleAccordionExpand(id: string) {
    setIsAccordionOpen(true);
    props.onExpand?.(id);
  }

  function handleAccordionCollapse(id: string) {
    setIsAccordionOpen(false);
    props.onCollapse?.(id);
  }

  const shouldFetchNow = shouldFetchKeyDates && (!isAccordionGated || isAccordionOpen);

  const { data: keyDatesData, isLoading: isKeyDatesLoading } = useUpcomingKeyDates(
    props.appointment.trusteeId,
    props.appointment.id,
    shouldFetchNow,
  );

  if (showsChpt13StandingUpcomingKeyDates) {
    return (
      <Chapter13StandingAppointmentBody
        appointment={props.appointment}
        keyDatesData={keyDatesData}
        isKeyDatesLoading={isKeyDatesLoading}
        expandedId={props.expandedId}
        onExpand={handleAccordionExpand}
        onCollapse={handleAccordionCollapse}
      />
    );
  }

  return (
    <div
      className="appointment-card-container"
      data-testid={`appointment-card-${props.appointment.id}`}
    >
      <h3 className="appointment-card-heading">{appointmentCardHeaderText}</h3>
      <div className="appointment-cards-row">
        <InfoCard
          id={`edit-trustee-appointment-${props.appointment.id}`}
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
      </div>
    </div>
  );
}
