import './TrusteeAppointments.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { TrusteeAppointment, formatAppointmentStatus, isChapter12Standing, isChapter13Standing } from '@common/cams/trustee-appointments';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AppointmentCard from './AppointmentCard';
import AppointmentCardV2 from './AppointmentCardV2';
import Button from '@/lib/components/uswds/Button';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Icon from '@/lib/components/uswds/Icon';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import { useNavigate } from 'react-router-dom';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_LAYOUT_V2 } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

interface TrusteeAppointmentsProps {
  trusteeId: string;
}

interface AppointmentAccordionProps {
  appointment: TrusteeAppointment;
  canManage: boolean;
}

const ACCORDION_STORAGE_KEY = (trusteeId: string) => `cams:appt-open:${trusteeId}`;

function readAccordionState(trusteeId: string): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(ACCORDION_STORAGE_KEY(trusteeId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAccordionState(trusteeId: string, appointmentId: string, open: boolean) {
  try {
    const state = readAccordionState(trusteeId);
    state[appointmentId] = open;
    sessionStorage.setItem(ACCORDION_STORAGE_KEY(trusteeId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function AppointmentAccordion({ appointment, canManage }: Readonly<AppointmentAccordionProps>) {
  const isActive = appointment.status === 'active';
  const hasKeyDates =
    (appointment.chapter === '7' && appointment.appointmentType === 'panel') ||
    (appointment.chapter === '11-subchapter-v' && appointment.appointmentType === 'pool') ||
    (appointment.chapter === '12' && appointment.appointmentType === 'case-by-case') ||
    (appointment.chapter === '13' && appointment.appointmentType === 'case-by-case') ||
    isChapter12Standing(appointment.chapter, appointment.appointmentType) ||
    isChapter13Standing(appointment.chapter, appointment.appointmentType);

  const savedState = readAccordionState(appointment.trusteeId);
  const hasSavedState = appointment.id in savedState;
  const startOpen = hasSavedState ? savedState[appointment.id] : isActive;

  const [keyDatesData, setKeyDatesData] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [isKeyDatesLoading, setIsKeyDatesLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const navigate = useNavigate();

  const formattedChapter = formatChapterType(appointment.chapter);
  const formattedType = formatAppointmentType(appointment.appointmentType);
  const formattedStatus = formatAppointmentStatus(appointment.status);

  let appointmentHeading = appointment.courtName ?? appointment.courtId ?? '';
  if (appointment.courtDivisionName) appointmentHeading += ` (${appointment.courtDivisionName})`;
  appointmentHeading += ` - Chapter ${formattedChapter} ${formattedType}`;

  function fetchKeyDates() {
    setHasFetched(true);
    setIsKeyDatesLoading(true);
    Api2.getUpcomingKeyDates(appointment.trusteeId, appointment.id)
      .then((response) => setKeyDatesData(response.data))
      .catch(() => setKeyDatesData(null))
      .finally(() => setIsKeyDatesLoading(false));
  }

  useEffect(() => {
    if (hasKeyDates) fetchKeyDates();
  }, []);

  function handleToggle(expanded: boolean) {
    writeAccordionState(appointment.trusteeId, appointment.id, expanded);
    if (expanded && hasKeyDates && !hasFetched) fetchKeyDates();
  }

  function handleEditKeyDates(section: 'audit' | 'tpr' | 'tir' | 'annual-report' | 'other') {
    navigate(
      `/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit-key-dates-v2/${section}`,
      {
        state: {
          keyDatesData,
          subHeading: appointmentHeading,
          chapter: appointment.chapter,
          appointmentType: appointment.appointmentType,
        },
      },
    );
  }

  return (
    <div className="usa-accordion appointment-accordion">
      <Accordion
        id={appointment.id}
        initialExpanded={startOpen}
        onToggle={handleToggle}
      >
        <span className="appointment-accordion-title">
          {appointmentHeading}
          <Tag uswdsStyle={isActive ? UswdsTagStyle.Green : UswdsTagStyle.Default}>
            {formattedStatus}
          </Tag>
        </span>
        <AppointmentCardV2
          appointment={appointment}
          keyDatesData={keyDatesData}
          isLoading={isKeyDatesLoading}
          canManage={canManage}
          appointmentHeading={appointmentHeading}
          onEditKeyDates={handleEditKeyDates}
        />
      </Accordion>
    </div>
  );
}

export default function TrusteeAppointments(props: Readonly<TrusteeAppointmentsProps>) {
  const { trusteeId } = props;
  const [appointments, setAppointments] = useState<TrusteeAppointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const featureFlags = useFeatureFlags();
  const useLayoutV2 = featureFlags[TRUSTEE_APPOINTMENT_LAYOUT_V2] === true;
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

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
        {sortedAppointments.map((appointment) =>
          useLayoutV2 ? (
            <AppointmentAccordion
              key={appointment.id}
              appointment={appointment}
              canManage={canManage}
            />
          ) : (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ),
        )}
      </div>
    </div>
  );
}
