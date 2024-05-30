import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { Consolidation } from '@common/cams/events';
import { useGenericApi } from './UseApi';
import { Order } from '@common/cams/orders';

export function useApi2() {
  const api = useGenericApi();
  return {
    async getCaseSummary(caseId: string) {
      return api.get<CaseSummary>(`/cases/${caseId}/summary`);
    },

    async getCaseAssignments(caseId: string) {
      return api.get<Array<CaseAssignment>>(`/case-assignments/${caseId}`);
    },

    async getCaseAssociations(caseId: string) {
      return api.get<Array<Consolidation>>(`/cases/${caseId}/associated`);
    },

    async getOffices() {
      return api.get<OfficeDetails[]>(`/offices`);
    },

    async getOrders() {
      return api.get<Order[]>(`/orders`, {});
    },
  };
}
