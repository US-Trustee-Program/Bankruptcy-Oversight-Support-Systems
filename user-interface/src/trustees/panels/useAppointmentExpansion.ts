import { useSessionState } from '@/lib/hooks/UseSessionState';

export interface UseAppointmentExpansion {
  isExpanded: (appointment: { id: string }) => boolean;
  toggleExpanded: (appointmentId: string) => void;
}

export function useAppointmentExpansion(trusteeId: string): UseAppointmentExpansion {
  const [expandedIds, setExpandedIds] = useSessionState<Record<string, boolean>>(
    `trustee-appointments-expanded-${trusteeId}`,
    {},
  );

  function isExpanded(appointment: { id: string }): boolean {
    return expandedIds[appointment.id] ?? false;
  }

  function toggleExpanded(appointmentId: string) {
    setExpandedIds((prev) => {
      const next = { ...prev };
      if (next[appointmentId]) {
        delete next[appointmentId];
      } else {
        next[appointmentId] = true;
      }
      return next;
    });
  }

  return { isExpanded, toggleExpanded };
}
