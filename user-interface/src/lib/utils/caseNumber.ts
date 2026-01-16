import { VALID_CASEID_PATTERN } from '@common/cams/cases';

export function getCaseNumber(caseId: string | undefined): string {
  if (caseId) {
    const caseData = caseId.split('-');
    if (caseData.length === 2) return caseId;
    return `${caseData[1]}-${caseData[2]}`;
  }
  return '';
}

export function copyCaseNumber(caseId: string | undefined): void {
  if (caseId && VALID_CASEID_PATTERN.test(caseId)) {
    navigator.clipboard?.writeText(caseId).catch(() => {
      // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
    });
  }
}
