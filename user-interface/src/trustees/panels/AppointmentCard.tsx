import './AppointmentCard.scss';
import UpcomingKeyDates from './UpcomingKeyDates';
import PastKeyDates from './PastKeyDates';
import InfoCard from './InfoCard';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import useEditTrusteeAppointment from '@/lib/hooks/UseEditTrusteeAppointment';
import useFeatureFlags, {
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  DISPLAY_CHPT13_STANDING_KEY_DATES,
  TPR_DISPLAY_UPDATES,
} from '@/lib/hooks/UseFeatureFlags';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { isChapter13Standing } from '@common/cams/trustee-appointments';
import { formatAppointmentDate, buildDistrictDisplay } from './appointmentDisplay';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const { canManage, openEditTrustee } = useEditTrusteeAppointment(props.appointment);

  const featureFlags = useFeatureFlags();
  const displayChpt1213CaseByCaseUpcomingKeyDates =
    featureFlags[DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES] === true;
  const displayChpt13StandingKeyDates = featureFlags[DISPLAY_CHPT13_STANDING_KEY_DATES] === true;
  const tprDisplayUpdates = !!featureFlags[TPR_DISPLAY_UPDATES];
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

  let appointmentHeading = districtDisplay;
  if (props.appointment.courtDivisionName) {
    appointmentHeading += ` (${props.appointment.courtDivisionName})`;
  }
  appointmentHeading += ` - Chapter ${formattedChapter} ${formattedAppointmentType}`;

  const isCh1213CaseByCase =
    (props.appointment.chapter === '12' || props.appointment.chapter === '13') &&
    props.appointment.appointmentType === 'case-by-case';
  const isChapter13StandingAppointment = isChapter13Standing(chapter, appointmentType);

  const showsCh1213UpcomingKeyDatesCard =
    displayChpt1213CaseByCaseUpcomingKeyDates && isCh1213CaseByCase;
  const showsChpt13StandingUpcomingKeyDates =
    displayChpt13StandingKeyDates && isChapter13StandingAppointment;
  const shouldFetchKeyDates =
    showsCh1213UpcomingKeyDatesCard || showsChpt13StandingUpcomingKeyDates;

  const { data: keyDatesData, isLoading: isKeyDatesLoading } = useUpcomingKeyDates(
    props.appointment.trusteeId,
    props.appointment.id,
    shouldFetchKeyDates,
  );

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
        {showsCh1213UpcomingKeyDatesCard && (
          <UpcomingKeyDates
            variant="ch12-13-case-by-case"
            trusteeId={props.appointment.trusteeId}
            appointmentId={props.appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDatesData}
            isLoading={isKeyDatesLoading}
            tprDisplayUpdates={tprDisplayUpdates}
          />
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
              tprDisplayUpdates={tprDisplayUpdates}
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
