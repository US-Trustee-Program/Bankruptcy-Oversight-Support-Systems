import { useState } from 'react';
import { AppointmentStatus } from '@common/cams/trustees';
import { isActiveAppointment } from './appointmentDisplay';

export interface UseAppointmentExpansion {
  isExpanded: (appointment: { id: string; status: AppointmentStatus }) => boolean;
  toggleExpanded: (appointment: { id: string; status: AppointmentStatus }) => void;
}

function storageKey(trusteeId: string): string {
  return `appointment-expansion-${trusteeId}`;
}

function readStoredIds(trusteeId: string): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(storageKey(trusteeId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredIds(trusteeId: string, expandedIds: Record<string, boolean>) {
  try {
    sessionStorage.setItem(storageKey(trusteeId), JSON.stringify(expandedIds));
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing); expansion
    // state simply won't persist across navigation in that case.
  }
}

/**
 * Expansion state is backed by sessionStorage (keyed by trusteeId) so it
 * survives navigating away to an edit form and back. An appointment with no
 * explicit user toggle yet defaults to expanded when active, collapsed
 * otherwise.
 */
export function useAppointmentExpansion(trusteeId: string): UseAppointmentExpansion {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() =>
    readStoredIds(trusteeId),
  );

  function isExpanded(appointment: { id: string; status: AppointmentStatus }): boolean {
    return expandedIds[appointment.id] ?? isActiveAppointment(appointment.status);
  }

  function toggleExpanded(appointment: { id: string; status: AppointmentStatus }) {
    setExpandedIds((prev) => {
      const current = prev[appointment.id] ?? isActiveAppointment(appointment.status);
      const next = { ...prev, [appointment.id]: !current };
      writeStoredIds(trusteeId, next);
      return next;
    });
  }

  return { isExpanded, toggleExpanded };
}
