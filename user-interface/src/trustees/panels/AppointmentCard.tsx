import './AppointmentCard.scss';
import InfoCard from './InfoCard';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import useEditTrusteeAppointment from '@/lib/hooks/UseEditTrusteeAppointment';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import { formatAppointmentDate, buildDistrictDisplay } from './appointmentDisplay';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const { canManage, openEditTrustee } = useEditTrusteeAppointment(props.appointment);

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
