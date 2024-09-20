export function getCaseNumber(caseId: string | undefined): string {
  if (caseId) {
    const caseData = caseId.split('-');
    if (caseData.length === 2) return caseId;
    return `${caseData[1]}-${caseData[2]}`;
  }
  return '';
}

export function copyCaseNumber(caseId: string | undefined): void {
  const CASE_ID_PATTERN = /^\d{3}-\d{2}-\d{5}$/;
  if (caseId && CASE_ID_PATTERN.test(caseId)) {
    navigator.clipboard.writeText(caseId);
  }
}
