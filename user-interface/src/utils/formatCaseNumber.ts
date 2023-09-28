export function getCaseNumber(caseId: string): string {
  const caseData = caseId.split('-');
  return `${caseData[1]}-${caseData[2]}`;
}
