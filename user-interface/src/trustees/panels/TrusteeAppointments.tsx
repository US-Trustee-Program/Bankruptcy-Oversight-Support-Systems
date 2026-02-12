import './TrusteeAppointments.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
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

  const getStateFromCourtName = (courtName: string): string => {
    // Extract state name from court name patterns like:
    // "Southern District of New York" -> "New York"
    // "District of Columbia" -> "Columbia"
    // "Eastern District of California" -> "California"
    const match = courtName.match(/District of (.+)$/i);
    return match ? match[1] : courtName;
  };

  const getChapterNumber = (chapter: string): number => {
    // Extract numeric value from chapter (e.g., '7' -> 7, '11-subchapter-v' -> 11)
    const match = chapter.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const sortAppointments = (appointments: TrusteeAppointment[]): TrusteeAppointment[] => {
    return [...appointments].sort((a, b) => {
      // 1. Sort by state alphabetically (derived from courtName)
      const stateA = getStateFromCourtName(a.courtName || '');
      const stateB = getStateFromCourtName(b.courtName || '');
      const stateComparison = stateA.localeCompare(stateB);
      if (stateComparison !== 0) return stateComparison;

      // 2. Sort by district name (courtName) alphabetically within each state
      const districtA = a.courtName || '';
      const districtB = b.courtName || '';
      const districtComparison = districtA.localeCompare(districtB);
      if (districtComparison !== 0) return districtComparison;

      // 3. Sort by division (courtDivisionName) alphabetically within each district
      const divisionA = a.courtDivisionName || '';
      const divisionB = b.courtDivisionName || '';
      const divisionComparison = divisionA.localeCompare(divisionB);
      if (divisionComparison !== 0) return divisionComparison;

      // 4. Sort by chapter in ascending order within each division
      const chapterA = getChapterNumber(a.chapter);
      const chapterB = getChapterNumber(b.chapter);
      const chapterComparison = chapterA - chapterB;
      if (chapterComparison !== 0) return chapterComparison;

      // 5. Sort by appointment type alphabetically within each chapter
      return a.appointmentType.localeCompare(b.appointmentType);
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

  const sortedAppointments = sortAppointments(appointments);

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
