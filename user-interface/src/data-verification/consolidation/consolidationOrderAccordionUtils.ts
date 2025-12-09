import { CaseAssignment } from '@common/cams/assignments';
import useApi2 from '@/lib/hooks/UseApi2';
import { CaseSummary } from '@common/cams/cases';

export function getCaseId(params: { court?: string; caseNumber?: string }) {
  if (
    params.court &&
    params.court.length === 3 &&
    params.caseNumber &&
    params.caseNumber.length === 8
  ) {
    return `${params.court}-${params.caseNumber}`;
  }
  return '';
}

export async function fetchLeadCaseAttorneys(leadCaseId: string) {
  const caseAssignments: CaseAssignment[] = (await useApi2().getCaseAssignments(leadCaseId)).data;
  if (caseAssignments.length && caseAssignments[0].name) {
    return caseAssignments.map((assignment) => assignment.name);
  } else {
    return [];
  }
}

export function getUniqueDivisionCodeOrUndefined(cases: CaseSummary[]) {
  const divisionCodeSet = cases.reduce((set, bCase) => {
    set.add(bCase.courtDivisionCode);
    return set;
  }, new Set<string>());
  return divisionCodeSet.size === 1 ? Array.from<string>(divisionCodeSet)[0] : undefined;
}
