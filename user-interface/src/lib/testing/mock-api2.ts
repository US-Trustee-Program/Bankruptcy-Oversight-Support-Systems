import { ResponseBody } from '@common/api/response';
import { ObjectKeyVal } from '../type-declarations/basic';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions, { ResourceActions } from '@common/cams/actions';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { CaseBasics, CaseDetail, CaseDocket, CaseSummary } from '@common/cams/cases';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { AttorneyUser } from '@common/cams/users';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseHistory } from '@common/cams/history';
import { CamsSession } from '@common/cams/session';
import { OfficeDetails } from '@common/cams/courts';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
  TransferOrder,
} from '@common/cams/orders';
import { CasesSearchPredicate } from '@common/api/search';

const caseDocketEntries = MockData.buildArray(MockData.getDocketEntry, 5);
const caseActions = [Actions.ManageAssignments];
const caseDetails = MockData.getCaseDetail({
  override: { _actions: caseActions, chapter: '15' },
});
const offices = MockData.getOffices().slice(0, 5);

// Consolidated Lead Case
const consolidationLeadCaseId = '999-99-00001';
const consolidationLeadCaseSummary = MockData.getCaseSummary({
  override: { caseId: consolidationLeadCaseId },
});
const consolidation: Array<ConsolidationTo | ConsolidationFrom> = [
  MockData.getConsolidationReference({
    override: {
      otherCase: consolidationLeadCaseSummary,
      documentType: 'CONSOLIDATION_TO',
    },
  }),
  MockData.getConsolidationReference({
    override: { caseId: consolidationLeadCaseId },
  }),
  MockData.getConsolidationReference({
    override: { caseId: consolidationLeadCaseId },
  }),
];
const consolidationLeadCase = MockData.getCaseDetail({
  override: {
    ...consolidationLeadCaseSummary,
    consolidation: consolidation,
  },
});

const orders = [
  MockData.getTransferOrder({ override: { id: 'guid-0', orderDate: '2024-01-01' } }),
  MockData.getTransferOrder({
    override: { id: 'guid-1', orderDate: '2024-02-01', status: 'approved' },
  }),
  MockData.getTransferOrder({
    override: { id: 'guid-2', orderDate: '2024-03-01', status: 'rejected' },
  }),
  MockData.getConsolidationOrder({ override: { id: 'guid-3', orderDate: '2024-04-01' } }),
  MockData.getConsolidationOrder({
    override: {
      id: 'guid-4',
      orderDate: '2024-05-01',
      status: 'approved',
      leadCase: {
        ...consolidationLeadCaseSummary,
      },
    },
  }),
  MockData.getConsolidationOrder({
    override: {
      id: 'guid-5',
      orderDate: '2024-06-01',
      status: 'rejected',
      reason: 'This is a rejection reason.',
    },
  }),
];

async function post<_T = unknown>(
  path: string,
  body: object,
  _options: ObjectKeyVal,
): Promise<ResponseBody<unknown>> {
  if (path.match(/\/cases/)) {
    const searchRequest = body as CasesSearchPredicate;
    const _actions = [Actions.ManageAssignments];
    const caseNumber = searchRequest ? searchRequest.caseNumber : '';
    const response: ResponseBody<ResourceActions<CaseBasics>[]> = {
      data: [],
    };
    if (caseNumber === '99-99999') {
      return Promise.reject(new Error('api error'));
    } else if (caseNumber === '00-00000') {
      response.data = [MockData.getCaseBasics({ override: { caseId: `011-${caseNumber}` } })];
    } else if (caseNumber === '11-00000') {
      response.data = [];
    } else {
      response.data = [
        { ...MockData.getCaseBasics({ override: { caseId: `011-${caseNumber}` } }), _actions },
        { ...MockData.getCaseBasics({ override: { caseId: `070-${caseNumber}` } }), _actions },
        { ...MockData.getCaseBasics({ override: { caseId: `132-${caseNumber}` } }), _actions },
        { ...MockData.getCaseBasics({ override: { caseId: `3E1-${caseNumber}` } }), _actions },
        { ...MockData.getCaseBasics({ override: { caseId: `256-${caseNumber}` } }), _actions },
      ];
    }
    return response;
  } else {
    return Promise.reject(new Error());
  }
}

async function get<T = unknown>(path: string): Promise<ResponseBody<T>> {
  let response: ResponseBody<unknown>;
  if (path.match(/\/cases\/123-12-12345\/docket/)) {
    return Promise.reject(new Error());
  } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
    return Promise.reject({ message: 'Case summary not found for the case ID.' });
  } else if (path.match(/\/cases\/999-99-00001\/associated/)) {
    response = {
      data: consolidation,
    };
  } else if (path.match(/\/cases\/999-99-00001\/docket/)) {
    response = {
      data: [],
    };
  } else if (path.match(/\/cases\/999-99-00001/)) {
    response = {
      data: {
        ...consolidationLeadCase,
        consolidation,
      },
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/docket/)) {
    response = {
      data: caseDocketEntries,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/summary/i)) {
    response = {
      data: caseDetails,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/associated/)) {
    response = {
      data: [],
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+/)) {
    response = {
      data: caseDetails,
    };
  } else if (path.match(/\/orders-suggestions\/[A-Z\d-]+/)) {
    response = {
      data: [caseDetails],
    };
  } else if (path.match(/\/orders/)) {
    response = {
      data: orders,
    };
  } else if (path.match(/\/offices/)) {
    response = {
      data: offices,
    };
  } else if (path.match(/\/me/)) {
    response = {
      data: MockData.getCamsSession({ user: SUPERUSER.user }),
    };
  } else {
    response = {
      data: {},
    };
  }

  return Promise.resolve(response as ResponseBody<T>);
}

async function patch<_T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody> {
  const response = {
    data,
  };
  return Promise.resolve(response);
}

async function put<_T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody> {
  const response = {
    data,
  };
  return Promise.resolve(response);
}

async function getAttorneys() {
  return get<AttorneyUser[]>('/attorneys');
}

async function getCaseDetail(caseId: string) {
  return get<CaseDetail>(`/cases/${caseId}`);
}

async function getCaseDocket(caseId: string) {
  return get<CaseDocket>(`/cases/${caseId}/docket`);
}

async function getCaseSummary(caseId: string) {
  return get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCaseAssignments(caseId: string) {
  return get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string) {
  return get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getCaseHistory(caseId: string) {
  return get<CaseHistory[]>(`/cases/${caseId}/history`);
}

async function getMe() {
  return get<CamsSession>(`/me`);
}

async function getOffices(): Promise<ResponseBody<OfficeDetails[]>> {
  return get<OfficeDetails[]>(`/offices`);
}

async function getOrders() {
  return get<Order[]>(`/orders`);
}

async function getOrderSuggestions(caseId: string) {
  return get<CaseSummary[]>(`/orders-suggestions/${caseId}/`);
}

async function patchTransferOrder(data: FlexibleTransferOrderAction) {
  return patch<TransferOrder>(`/orders/${data.id}`, data);
}

async function putConsolidationOrderApproval(data: ConsolidationOrderActionApproval) {
  return put<ConsolidationOrder[]>('/consolidations/approve', data);
}

async function putConsolidationOrderRejection(data: ConsolidationOrderActionRejection) {
  return put<ConsolidationOrder[]>('/consolidations/reject', data);
}

async function searchCases(predicate: CasesSearchPredicate) {
  return post<CaseBasics[]>('/cases', predicate, {});
}

export const MockApi2 = {
  getAttorneys,
  getCaseDetail,
  getCaseDocket,
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getCaseHistory,
  getMe,
  getOffices,
  getOrders,
  getOrderSuggestions,
  patchTransferOrder,
  putConsolidationOrderApproval,
  putConsolidationOrderRejection,
  searchCases,
};

export default MockApi2;
