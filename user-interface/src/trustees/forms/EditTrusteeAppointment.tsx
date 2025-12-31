import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import TrusteeAppointmentForm from './TrusteeAppointmentForm';

export default function EditTrusteeAppointment() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const [appointment, setAppointment] = useState<TrusteeAppointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAppointment = async () => {
      try {
        const response = await Api2.getTrusteeAppointments(trusteeId!);
        const found = response.data?.find((a) => a.id === appointmentId);

        if (!found) {
          setError('Appointment not found');
        } else {
          setAppointment(found);
        }
      } catch (err) {
        setError('Failed to load appointment');
        console.error('Error loading appointment:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointment();
  }, [trusteeId, appointmentId]);

  if (isLoading) {
    return <LoadingSpinner caption="Loading appointment..." />;
  }

  if (error || !appointment || !trusteeId) {
    return (
      <div className="trustee-form-screen">
        <Alert type={UswdsAlertStyle.Error} inline={true} show={true}>
          {error || 'Unable to load appointment'}
        </Alert>
      </div>
    );
  }

  return <TrusteeAppointmentForm trusteeId={trusteeId} appointment={appointment} />;
}
