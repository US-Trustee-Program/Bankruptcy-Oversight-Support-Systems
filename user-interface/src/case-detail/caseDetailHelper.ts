import { CaseDetail } from '@common/cams/cases';

export function composeCaseTitle(caseDetail?: CaseDetail): string {
  if (!caseDetail) return '';
  if (caseDetail.jointDebtor?.name) {
    return `${caseDetail.debtor.name} & ${caseDetail.jointDebtor.name}`;
  }

  return caseDetail.debtor.name;
}
