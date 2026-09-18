import './TrusteeAppointments.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { isChapter13Standing, TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import Button from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { useNavigate } from 'react-router-dom';
import { useSessionState } from '@/lib/hooks/UseSessionState';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [persistedExpandedId, setPersistedExpandedId] = useSessionState<string>(
    `ch13-standing-expanded-${trusteeId}`,
    '',
  );
  const navigate = useNavigate();

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

  const ch13StandingIds = sortedAppointments
    .filter((a) => isChapter13Standing(a.chapter, a.appointmentType))
    .map((a) => a.id);
  const validPersistedId = ch13StandingIds.includes(persistedExpandedId) ? persistedExpandedId : '';
  const firstActiveCh13Id =
    sortedAppointments.find(
      (a) => isChapter13Standing(a.chapter, a.appointmentType) && a.status === 'active',
    )?.id ?? '';
  const initialExpandedId = validPersistedId || firstActiveCh13Id;

  return (
    <div className="trustee-appointments-list">
      <div className="toolbar">
        <Button id="add-appointment-button" onClick={handleAddAppointment}>
          <Icon name="add_circle" />
          Add New Appointment
        </Button>
      </div>
      <div className="appointments-list">
        <AccordionGroup initialExpandedId={initialExpandedId}>
          {sortedAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onExpand={setPersistedExpandedId}
              onCollapse={setPersistedExpandedId}
            />
          ))}
        </AccordionGroup>
      </div>
    </div>
  );
}
