import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { Consolidation } from '@common/cams/events';
import { useGenericApi } from './UseApi';
import { Order } from '@common/cams/orders';
import { CamsSession } from '@/login/login-library';

export function useApi2(session: CamsSession) {
  const api = useGenericApi(session);
  return {
    async getCaseSummary(caseId: string) {
      return api.get<CaseSummary>(`/cases/${caseId}/summary`);
    },

    async getCaseAssignments(caseId: string) {
      return api.get<CaseAssignment[]>(`/case-assignments/${caseId}`);
    },

    async getCaseAssociations(caseId: string) {
      return api.get<Consolidation[]>(`/cases/${caseId}/associated`);
    },

    async getOffices() {
      return api.get<OfficeDetails[]>(`/offices`);
    },

    async getOrders() {
      return api.get<Order[]>(`/orders`, {});
    },
  };
}
