import { CaseDetail } from '@common/cams/cases';

export function composeCaseTitle(caseDetail?: CaseDetail): string {
  if (!caseDetail) return '';
  if (caseDetail.jointDebtor?.name) {
    return `${caseDetail.debtor.name} & ${caseDetail.jointDebtor.name}`;
  }

  return caseDetail.debtor.name;
}

export function testFunction(name: string): string {
  if (name.toLocaleLowerCase() === 'john') return 'The best is back';
  return `Hello ${name}`;
}
