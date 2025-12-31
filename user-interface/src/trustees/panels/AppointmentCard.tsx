import './AppointmentCard.scss';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const formattedChapter = formatChapterType(props.appointment.chapter);
  let districtDisplay;
  if (props.appointment.courtName && props.appointment.courtDivisionName) {
    districtDisplay = `${props.appointment.courtName} (${props.appointment.courtDivisionName})`;
  } else {
    districtDisplay = 'Court not found';
  }
  const formattedEffectiveDate = formatDate(props.appointment.effectiveDate);
  const formattedAppointedDate = formatDate(props.appointment.appointedDate);
  const statusDisplay = `${props.appointment.status.charAt(0).toUpperCase() + props.appointment.status.slice(1)} ${formattedEffectiveDate}`;

  return (
    <div className="appointment-card-container">
      <h3 className="appointment-card-heading">
        {districtDisplay} - Chapter {formattedChapter}
      </h3>
      <div className="appointment-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="appointment-card-header">
              <h4>Key Information</h4>
              <Link
                to={`/trustees/${props.appointment.trusteeId}/appointments/${props.appointment.id}/edit`}
                className="appointment-edit-link"
              >
                <Icon name="edit" />
                Edit
              </Link>
            </div>
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
                <span className="appointment-label">Appointed:</span> {formattedAppointedDate}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
