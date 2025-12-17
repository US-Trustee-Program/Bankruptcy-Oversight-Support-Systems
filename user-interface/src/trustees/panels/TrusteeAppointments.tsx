import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import Button from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  if (appointments.length === 0) {
    return (
      <div className="trustee-appointments-list">
<<<<<<< HEAD
        <div className="record-detail-container">There are no appointments for this Trustee.</div>
=======
        <div className="record-detail-container">
          <div className="empty-appointments-state">
            <Button
              id="add-appointment-button"
              onClick={() => {
                // TODO: Implement add appointment functionality
              }}
            >
              <Icon name="add_circle" />
              Add New Appointment
            </Button>
            <p className="margin-top-2">There are no appointments for this Trustee.</p>
          </div>
        </div>
>>>>>>> 1763c5424 (Added 'Add' button to empty appointments screen)
      </div>
    );
  }

  return (
    <div className="trustee-appointments-list">
      <div className="appointments-list">
        {appointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))}
      </div>
    </div>
  );
}
