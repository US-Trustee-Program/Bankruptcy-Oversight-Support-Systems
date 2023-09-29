export function getCaseNumber(caseId: string | undefined): string {
  if (caseId) {
    const caseData = caseId.split('-');
    return `${caseData[1]}-${caseData[2]}`;
  }
  return '';
}
