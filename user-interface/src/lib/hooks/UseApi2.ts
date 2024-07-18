import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { Consolidation } from '@common/cams/events';
import { useGenericApi } from './UseApi';
import { Order } from '@common/cams/orders';

const api = useGenericApi;

async function getCaseSummary(caseId: string) {
  return api().get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCaseAssignments(caseId: string) {
  return api().get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string) {
  return api().get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getOffices() {
  return api().get<OfficeDetails[]>(`/offices`);
}

async function getOrders() {
  return api().get<Order[]>(`/orders`, {});
}

export const Api2 = {
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getOffices,
  getOrders,
};

// TODO: Deprecate this hook.
export function useApi2() {
  return Api2;
}

export default Api2;
