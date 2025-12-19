import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import './AppointmentCard.scss';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
  districtName?: string;
  courtDivisionName?: string;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  console.log('Rendering AppointmentCard with props:', props);
  // const { appointment } = props;
  console.log('AppointmentCard props:', props.appointment);

  const formattedChapter = formatChapterType(props.appointment.chapter);
  // const districtDisplay = districtName || `Court ${appointment.courtId}`;
  const districtDisplay = `${props.appointment?.courtName} (${props.appointment?.courtDivisionName})`;
  // const cityDisplay = props.appointment?.courtDivisionName ? ` (${props.appointment?.courtDivisionName})` : '';
  const formattedEffectiveDate = formatDate(props.appointment.effectiveDate);
  const statusDisplay = `${props.appointment.status.charAt(0).toUpperCase() + props.appointment.status.slice(1)} ${formattedEffectiveDate}`;

  return (
    <div className="appointment-card-container">
      <h3 className="appointment-card-heading">
        {districtDisplay} - Chapter {formattedChapter}
      </h3>
      <div className="appointment-card usa-card">
        <div className="usa-card__body">
          <h4>Key Information</h4>
          <ul className="appointment-details-list">
            <li>
              <span className="appointment-label">District:</span> {districtDisplay}
            </li>
            <li>
              <span className="appointment-label">Chapter:</span> {formattedChapter}
            </li>
            <li>
              <span className="appointment-label">Status:</span> {statusDisplay}
            </li>
            <li>
              <span className="appointment-label">Appointed:</span> {props.appointment.appointedDate}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
