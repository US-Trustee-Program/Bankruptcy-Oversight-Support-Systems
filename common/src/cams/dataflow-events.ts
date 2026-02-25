import { CaseAssignment } from './assignments';
import { DxtrCase } from './cases';
import { LegacyAddress } from './parties';

/**
 * Event triggered when trial attorney assignments change (add/remove).
 * Processed by dataflows to maintain office assignee records.
 */
export type CaseAssignmentEvent = CaseAssignment;

/**
 * Event triggered when a case is closed.
 * Processed by dataflows to remove all office assignee records for the case.
 */
export type CaseClosedEvent = {
  caseId: string;
};

/**
 * Event triggered to reload/sync a case from DXTR.
 * Processed by dataflows to update case data in MongoDB.
 */
export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
  retryCount?: number;
};

/**
 * Trustee party data from DXTR AO_PY table.
 * Used during trustee appointment sync to match against CAMS trustees.
 */
export type DxtrTrusteeParty = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  generation?: string;
  fullName: string;
  legacy?: LegacyAddress & {
    phone?: string;
    fax?: string;
    email?: string;
  };
};

/**
 * Event triggered when a trustee appointment is detected in DXTR.
 * Processed by sync-trustee-appointments dataflow to match and link trustees to cases.
 */
export type TrusteeAppointmentSyncEvent = {
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  error?: unknown;
  retryCount?: number;
};
