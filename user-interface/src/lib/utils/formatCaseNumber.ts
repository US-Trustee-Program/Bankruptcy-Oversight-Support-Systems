export function getCaseNumber(caseId: string | undefined): string {
  if (caseId) {
    const caseData = caseId.split('-');
    if (caseData.length === 2) return caseId;
    return `${caseData[1]}-${caseData[2]}`;
  }
  return '';
}
