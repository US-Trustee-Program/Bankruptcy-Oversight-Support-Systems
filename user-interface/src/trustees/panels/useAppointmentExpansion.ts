import { useEffect } from 'react';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { useSessionState } from '@/lib/hooks/UseSessionState';
import { isActiveAppointment } from './appointmentDisplay';

interface ExpandedEntry {
  status: TrusteeAppointment['status'];
  expanded: boolean;
}

export interface UseAppointmentExpansion {
  isExpanded: (appointment: TrusteeAppointment) => boolean;
  toggleExpanded: (appointmentId: string) => void;
}

function defaultExpanded(appointment: TrusteeAppointment): boolean {
  return isActiveAppointment(appointment.status);
}

export function useAppointmentExpansion(
  trusteeId: string,
  appointments: TrusteeAppointment[],
): UseAppointmentExpansion {
  const [expandedMap, setExpandedMap] = useSessionState<Record<string, ExpandedEntry>>(
    `trustee-appointments-expanded-${trusteeId}`,
    {},
  );

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

  return { isExpanded, toggleExpanded };
}
