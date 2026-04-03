import { VALID_CASEID_PATTERN } from '@common/cams/cases';
import { copyStringToClipboard } from './clipBoard';

export function copyCaseNumber(caseId: string | undefined): void {
  if (caseId && VALID_CASEID_PATTERN.test(caseId)) {
    copyStringToClipboard(caseId);
  }
}
