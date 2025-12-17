import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import './AppointmentCard.scss';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
  districtName?: string;
  cityName?: string;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const { appointment, districtName, cityName } = props;

  const formattedChapter = formatChapterType(appointment.chapter);
  const districtDisplay = districtName || `Court ${appointment.courtId}`;
  const cityDisplay = cityName ? ` (${cityName})` : '';
  const formattedEffectiveDate = formatDate(appointment.effectiveDate);
  const statusDisplay = `${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)} ${formattedEffectiveDate}`;

  return (
    <div className="appointment-card-container">
      <h3 className="appointment-card-heading">
        {districtDisplay}
        {cityDisplay} - Chapter {formattedChapter}
      </h3>
      <div className="appointment-card usa-card">
        <div className="usa-card__body">
          <h4>Key Information</h4>
          <ul className="appointment-details-list">
            <li>
              <span className="appointment-label">District:</span> {districtDisplay}
              {cityDisplay}
            </li>
            <li>
              <span className="appointment-label">Chapter:</span> {formattedChapter}
            </li>
            <li>
              <span className="appointment-label">Status:</span> {statusDisplay}
            </li>
            <li>
              <span className="appointment-label">Appointed:</span> {appointment.appointedDate}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
