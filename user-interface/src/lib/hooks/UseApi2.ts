import { CaseAssignment } from '@common/cams/assignments';
import { CaseBasics, CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { Consolidation } from '@common/cams/events';
import { useGenericApi } from './UseApi';
import { Order } from '@common/cams/orders';
import { CamsSession } from '@common/cams/session';
import { CaseHistory } from '@common/cams/history';
import { AttorneyUser } from '@common/cams/users';
import { CasesSearchPredicate } from '@common/api/search';

const api = useGenericApi;

async function getAttorneys() {
  return api().get<AttorneyUser[]>('/attorneys');
}

async function getCaseSummary(caseId: string) {
  return api().get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCaseAssignments(caseId: string) {
  return api().get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string) {
  return api().get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getCaseHistory(caseId: string) {
  return api().get<CaseHistory[]>(`/cases/${caseId}/history`);
}

async function getMe() {
  return api().get<CamsSession>(`/me`);
}

async function getOffices() {
  return api().get<OfficeDetails[]>(`/offices`);
}

async function getOrders() {
  return api().get<Order[]>(`/orders`, {});
}

async function searchCases(predicate: CasesSearchPredicate) {
  return api().post<CaseBasics[]>('/cases', predicate);
}

export const Api2 = {
  getAttorneys,
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getCaseHistory,
  getMe,
  getOffices,
  getOrders,
  searchCases,
};

// TODO: Deprecate this hook.
export function useApi2() {
  return Api2;
}

export default Api2;
