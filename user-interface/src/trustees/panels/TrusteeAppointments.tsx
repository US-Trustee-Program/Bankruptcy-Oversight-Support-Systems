import './TrusteeAppointments.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import Button from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { useNavigate } from 'react-router-dom';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="trustee-appointments-list">
      <div className="toolbar">
        <Button id="add-appointment-button" onClick={handleAddAppointment}>
          <Icon name="add_circle" />
          Add New Appointment
        </Button>
      </div>
      <div className="appointments-list">
        {sortedAppointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))}
      </div>
    </div>
  );
}
