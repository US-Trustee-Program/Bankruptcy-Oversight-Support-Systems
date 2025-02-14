import { DxtrCase } from '../cams/cases';

export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
};

export type CaseSyncResults = {
  events: CaseSyncEvent[];
  lastTxId?: string;
};

// TODO: Delete this with the dataflows refactor.
export type ExportCaseChangeEventsSummary = {
  changedCases: number;
  exportedAndLoaded: number;
  errors: number;
  noResult: number;
  completed: number;
  faulted: number;
};

/**
 * getDefaultSummary
 */
export function getDefaultSummary(
  override: Partial<ExportCaseChangeEventsSummary> = {},
): ExportCaseChangeEventsSummary {
  return {
    changedCases: 0,
    exportedAndLoaded: 0,
    errors: 0,
    noResult: 0,
    completed: 0,
    faulted: 0,
    ...override,
  };
}
