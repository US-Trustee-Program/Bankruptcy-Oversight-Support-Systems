import './TrusteeAppointments.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { TrusteeAppointment, isChapter11CaseByCase } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import AppointmentAccordion from './AppointmentAccordion';
import Chapter11CaseByCaseAppointmentBody from './Chapter11CaseByCaseAppointmentBody';
import Button from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { useNavigate } from 'react-router-dom';
import { useSessionState } from '@/lib/hooks/UseSessionState';
import { isActiveAppointment } from './appointmentDisplay';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  interface ExpandedEntry {
    status: TrusteeAppointment['status'];
    expanded: boolean;
  }

  const [expandedMap, setExpandedMap] = useSessionState<Record<string, ExpandedEntry>>(
    `trustee-appointments-expanded-${trusteeId}`,
    {},
  );

  function defaultExpanded(appointment: TrusteeAppointment): boolean {
    return isActiveAppointment(appointment.status);
  }

  function isExpanded(appointment: TrusteeAppointment): boolean {
    const entry = expandedMap[appointment.id];
    if (entry && entry.status === appointment.status) {
      return entry.expanded;
    }
    return defaultExpanded(appointment);
  }

  function toggleExpanded(appointmentId: string) {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) {
      return;
    }
    setExpandedMap((prev) => {
      const entry = prev[appointmentId];
      const currentlyExpanded =
        entry && entry.status === appointment.status
          ? entry.expanded
          : defaultExpanded(appointment);
      const nextExpanded = !currentlyExpanded;
      const next = { ...prev };
      if (nextExpanded === defaultExpanded(appointment)) {
        delete next[appointmentId];
      } else {
        next[appointmentId] = { status: appointment.status, expanded: nextExpanded };
      }
      return next;
    });
  }

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

  useEffect(() => {
    setExpandedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const appointment of appointments) {
        const entry = next[appointment.id];
        if (entry && entry.status !== appointment.status) {
          delete next[appointment.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [appointments, setExpandedMap]);

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
        {sortedAppointments.map((appointment) =>
          isChapter11CaseByCase(appointment.chapter, appointment.appointmentType) ? (
            <AppointmentAccordion
              key={appointment.id}
              appointment={appointment}
              expanded={isExpanded(appointment)}
              onToggle={toggleExpanded}
            >
              <Chapter11CaseByCaseAppointmentBody appointment={appointment} />
            </AppointmentAccordion>
          ) : (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ),
        )}
      </div>
    </div>
  );
}
