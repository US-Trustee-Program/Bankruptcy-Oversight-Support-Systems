import './TrusteeAppointments.scss';
import { ReactNode, useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import {
  TrusteeAppointment,
  isChapter11CaseByCase,
  isChapter7Elected,
} from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import AppointmentAccordion from './AppointmentAccordion';
import Chapter11CaseByCaseAppointmentBody from './Chapter11CaseByCaseAppointmentBody';
import Chapter7ElectedAppointmentBody from './Chapter7ElectedAppointmentBody';
import Button from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { useNavigate } from 'react-router-dom';
import { useAppointmentExpansion } from './useAppointmentExpansion';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

function resolveAccordionBody(appointment: TrusteeAppointment): ReactNode | undefined {
  if (isChapter11CaseByCase(appointment.chapter, appointment.appointmentType)) {
    return <Chapter11CaseByCaseAppointmentBody appointment={appointment} />;
  }
  if (isChapter7Elected(appointment.chapter, appointment.appointmentType)) {
    return <Chapter7ElectedAppointmentBody appointment={appointment} />;
  }
  return undefined;
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isExpanded, toggleExpanded } = useAppointmentExpansion(trusteeId);

  useEffect(() => {
    const loadAppointments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await Api2.getTrusteeAppointments(trusteeId);
        setAppointments(response.data ?? []);
      } catch (err) {
        setError('Failed to load trustee appointments');
        console.error('Error loading appointments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointments();
  }, [trusteeId]);

  if (isLoading) {
    return (
      <div className="trustee-appointments-list">
        <LoadingSpinner caption="Loading appointments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="trustee-appointments-list">
        <div className="record-detail-container">
          <Alert type={UswdsAlertStyle.Error} inline={true} show={true}>
            {error}
          </Alert>
        </div>
      </div>
    );
  }

  const handleAddAppointment = () => {
    navigate(`/trustees/${trusteeId}/appointments/create`, {
      state: { existingAppointments: appointments },
    });
  };

  if (appointments.length === 0) {
    return (
      <div className="trustee-appointments-list">
        <div className="toolbar">
          <Button id="add-appointment-button" onClick={handleAddAppointment}>
            <Icon name="add_circle" />
            Add New Appointment
          </Button>
        </div>
        <div className="appointments-list">There are no appointments for this Trustee.</div>
      </div>
    );
  }

  const sortedAppointments = sortByCourtLocation(appointments, { includeAppointmentDetails: true });

  return (
    <div className="trustee-appointments-list">
      <div className="toolbar">
        <Button id="add-appointment-button" onClick={handleAddAppointment}>
          <Icon name="add_circle" />
          Add New Appointment
        </Button>
      </div>
      <div className="appointments-list">
        {sortedAppointments.map((appointment) => {
          const accordionBody = resolveAccordionBody(appointment);
          return accordionBody ? (
            <AppointmentAccordion
              key={appointment.id}
              appointment={appointment}
              expanded={isExpanded(appointment)}
              onToggle={toggleExpanded}
            >
              {accordionBody}
            </AppointmentAccordion>
          ) : (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          );
        })}
      </div>
    </div>
  );
}
