import './AppointmentAccordion.scss';
import { ReactNode } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import { TrusteeAppointment, formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { getAppointmentDetails } from '@common/cams/trustees';
import useCourts from '@/lib/hooks/UseCourts';
import { buildDivisionsDisplay } from '@/lib/utils/court-utils';
import { buildDistrictDisplay, isActiveAppointment } from './appointmentDisplay';

export interface AppointmentAccordionProps {
  appointment: TrusteeAppointment;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export default function AppointmentAccordion(props: Readonly<AppointmentAccordionProps>) {
  const { appointment, expanded, onToggle, children } = props;

  const { courts: allCourts, error: courtsError } = useCourts();
  if (courtsError) {
    console.error('Error loading courts:', courtsError);
  }

  const districtDisplay = buildDistrictDisplay(appointment);
  const divisionsDisplay = buildDivisionsDisplay(appointment, allCourts);
  const isActive = isActiveAppointment(appointment.status);

  return (
    <div className="appointment-accordion">
      <Accordion
        id={appointment.id}
        expandedId={expanded ? appointment.id : undefined}
        onExpand={() => onToggle(appointment.id)}
        onCollapse={() => onToggle(appointment.id)}
      >
        <div
          className="appointment-accordion-header"
          data-testid={`appointment-accordion-header-${appointment.id}`}
        >
          <span className="appointment-accordion-heading-text">
            {districtDisplay} ({divisionsDisplay}) - Chapter{' '}
            {getAppointmentDetails(appointment.chapter, appointment.appointmentType)}
          </span>
          <Tag
            uswdsStyle={isActive ? UswdsTagStyle.Success : UswdsTagStyle.InactiveGray}
            id={`appointment-status-tag-${appointment.id}`}
          >
            {formatAppointmentStatus(appointment.status)}
          </Tag>
        </div>
        <div data-testid={`appointment-accordion-body-${appointment.id}`}>{children}</div>
      </Accordion>
    </div>
  );
}
