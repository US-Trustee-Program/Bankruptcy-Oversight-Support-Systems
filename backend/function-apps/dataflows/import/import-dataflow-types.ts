import { DxtrCase } from '../../../../common/src/cams/cases';

export type DxtrCaseChangeEvent = {
  type: 'CASE_CHANGED';
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
