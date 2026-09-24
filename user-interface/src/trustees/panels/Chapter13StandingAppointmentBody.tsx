import { useNavigate } from 'react-router-dom';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Chapter13StandingAuditCard from './Chapter13StandingAuditCard';
import Chapter13StandingTrusteePerformanceReportCard from './Chapter13StandingTrusteePerformanceReportCard';
import Chapter13StandingBudgetCard from './Chapter13StandingBudgetCard';
import Chapter13StandingOtherCard from './Chapter13StandingOtherCard';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { buildAppointmentHeading, formatAppointmentDate } from './appointmentDisplay';

export interface Chapter13StandingAppointmentBodyProps {
  appointment: TrusteeAppointment;
  keyDatesData: TrusteeUpcomingKeyDates | null;
  isKeyDatesLoading: boolean;
  expandedId?: string;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
}

/**
 * Accordion body for a Chapter 13 Standing appointment: header (district/division, chapter/type,
 * status tag), a slim details row (Appointed, Status Effective, Edit Appointment), and the four
 * themed key-dates cards. Isolated from AppointmentCard so its markup doesn't get tangled with the
 * other appointment variants' flat-card layout.
 */
export default function Chapter13StandingAppointmentBody(
  props: Readonly<Chapter13StandingAppointmentBodyProps>,
) {
  const { appointment, keyDatesData, isKeyDatesLoading, expandedId, onExpand, onCollapse } = props;
  const navigate = useNavigate();

  const formattedStatus = formatAppointmentStatus(appointment.status);
  const formattedAppointedDate = formatAppointmentDate(appointment.appointedDate);
  const formattedEffectiveDate = formatAppointmentDate(appointment.effectiveDate);

  const headerText = buildAppointmentHeading(appointment);

  function openEditTrustee() {
    navigate(`/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`);
  }

  const commonCardProps = {
    trusteeId: appointment.trusteeId,
    appointmentId: appointment.id,
    data: keyDatesData,
  };

  return (
    <div
      className="appointment-card-container chapter13-standing-appointment-card"
      data-testid={`appointment-card-${appointment.id}`}
    >
      <Accordion
        id={appointment.id}
        expandedId={expandedId}
        onExpand={onExpand}
        onCollapse={onCollapse}
      >
        {[
          <div key="header" className="chapter13-standing-accordion-header">
            <span>{headerText}</span>
            {formattedStatus === 'Active' ? (
              <Tag id="appointment-status" uswdsStyle={UswdsTagStyle.Green}>
                Active
              </Tag>
            ) : (
              <Tag id="appointment-status" uswdsStyle={UswdsTagStyle.Default}>
                {formattedStatus}
              </Tag>
            )}
          </div>,
          <div key="body" className="chapter13-standing-accordion-body">
            <div className="chapter13-standing-appointment-details">
              <span>
                <strong>Appointed:</strong> {formattedAppointedDate}
              </span>
              <span>
                <strong>Status Effective:</strong> {formattedEffectiveDate}
              </span>
              <Button
                id="edit-chapter13-standing-appointment"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                onClick={openEditTrustee}
              >
                <IconLabel icon="edit" label="Edit Appointment" />
              </Button>
            </div>
            {isKeyDatesLoading ? (
              <LoadingSpinner id="chapter13-standing-key-dates-loading" />
            ) : (
              <div
                className="chapter13-standing-cards-stack"
                data-testid="chapter13-standing-cards-stack"
              >
                <Chapter13StandingAuditCard {...commonCardProps} />
                <Chapter13StandingTrusteePerformanceReportCard {...commonCardProps} />
                <Chapter13StandingBudgetCard />
                <Chapter13StandingOtherCard {...commonCardProps} />
              </div>
            )}
          </div>,
        ]}
      </Accordion>
    </div>
  );
}
