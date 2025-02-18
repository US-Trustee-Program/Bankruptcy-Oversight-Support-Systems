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
