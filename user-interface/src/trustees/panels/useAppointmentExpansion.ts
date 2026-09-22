import { useState } from 'react';

export interface UseAppointmentExpansion {
  isExpanded: (appointment: { id: string }) => boolean;
  toggleExpanded: (appointmentId: string) => void;
}

export function useAppointmentExpansion(): UseAppointmentExpansion {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

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
