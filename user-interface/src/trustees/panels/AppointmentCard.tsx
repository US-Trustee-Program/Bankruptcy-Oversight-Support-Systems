import './AppointmentCard.scss';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { formatDate } from '@/lib/utils/datetime';
import { useNavigate } from 'react-router-dom';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

export interface AppointmentCardProps {
  appointment: TrusteeAppointment;
}

export default function AppointmentCard(props: Readonly<AppointmentCardProps>) {
  const navigate = useNavigate();
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

  function openEditTrustee() {
    navigate(`/trustees/${props.appointment.trusteeId}/appointments/${props.appointment.id}/edit`);
  }

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
              <Button
                id="edit-trustee-appointment"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee appointment"
                title="Edit trustee appointment"
                onClick={openEditTrustee}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
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
