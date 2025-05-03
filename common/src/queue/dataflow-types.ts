import { DxtrCase } from '../cams/cases';

export type CaseSyncEvent = {
  bCase?: DxtrCase;
  caseId: string;
  error?: unknown;
  retryCount?: number;
  type: 'CASE_CHANGED' | 'MIGRATION';
};

export type CaseSyncResults = {
  events: CaseSyncEvent[];
  lastTxId?: string;
};
