import { DxtrCase } from '../../../../common/src/cams/cases';

export type DxtrCaseChangeEvent = {
  type: string;
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
};
