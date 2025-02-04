import { DxtrCase } from '../../../../common/src/cams/cases';

export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
};

export type ExportCaseChangeEventsSummary = {
  changedCases: number;
  exportedAndLoaded: number;
  errors: number;
  noResult: number;
  completed: number;
  faulted: number;
};

export type CaseSyncResults = {
  events: CaseSyncEvent[];
  lastTxId?: string;
};
