import { useState } from 'react';
import { AppointmentStatus } from '@common/cams/trustees';

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
 * survives navigating away to an edit form and back within the same tab.
 *
 * An explicit user toggle, once stored, always wins. An appointment with no
 * stored toggle falls back to a default computed from the trustee's current
 * appointment count on every render: expanded only when the trustee has
 * exactly one appointment, otherwise collapsed. The default is never written
 * to storage, so it tracks the count as appointments are added or removed.
 */
export function useAppointmentExpansion(
  trusteeId: string,
  appointmentCount: number,
): UseAppointmentExpansion {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() =>
    readStoredIds(trusteeId),
  );
  const defaultExpanded = appointmentCount === 1;

  function isExpanded(appointment: { id: string; status: AppointmentStatus }): boolean {
    return expandedIds[appointment.id] ?? defaultExpanded;
  }

  function toggleExpanded(appointment: { id: string; status: AppointmentStatus }) {
    setExpandedIds((prev) => {
      const current = prev[appointment.id] ?? defaultExpanded;
      const next = { ...prev, [appointment.id]: !current };
      writeStoredIds(trusteeId, next);
      return next;
    });
  }

  return { isExpanded, toggleExpanded };
}
