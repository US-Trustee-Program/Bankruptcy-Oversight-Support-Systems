import { ResponseBody } from '@common/api/response';
import { ObjectKeyVal } from '../type-declarations/basic';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions, { ResourceActions } from '@common/cams/actions';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { CaseBasics, CaseDetail, CaseDocket, CaseSummary } from '@common/cams/cases';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { AttorneyUser } from '@common/cams/users';
import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
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

async function post<T = unknown>(
  path: string,
  body: object,
  _options: ObjectKeyVal,
): Promise<ResponseBody<T>> {
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
    return response as ResponseBody<ResourceActions<T>>;
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

async function patch<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return Promise.resolve(response as ResponseBody<T>);
}

async function put<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return Promise.resolve(response as ResponseBody<T>);
}

async function getAttorneys(): Promise<ResponseBody<AttorneyUser[]>> {
  return get<AttorneyUser[]>('/attorneys');
}

async function getCaseDetail(caseId: string): Promise<ResponseBody<CaseDetail>> {
  return get<CaseDetail>(`/cases/${caseId}`);
}

async function getCaseDocket(caseId: string): Promise<ResponseBody<CaseDocket>> {
  return get<CaseDocket>(`/cases/${caseId}/docket`);
}

async function getCaseSummary(caseId: string): Promise<ResponseBody<CaseSummary>> {
  return get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCaseAssignments(caseId: string): Promise<ResponseBody<CaseAssignment[]>> {
  return get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string): Promise<ResponseBody<Consolidation[]>> {
  return get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getCaseHistory(caseId: string): Promise<ResponseBody<CaseHistory[]>> {
  return get<CaseHistory[]>(`/cases/${caseId}/history`);
}

async function getMe(): Promise<ResponseBody<CamsSession>> {
  return get<CamsSession>(`/me`);
}

async function getOffices(): Promise<ResponseBody<OfficeDetails[]>> {
  return get<OfficeDetails[]>(`/offices`);
}

async function getOrders(): Promise<ResponseBody<Order[]>> {
  return get<Order[]>(`/orders`);
}

async function getOrderSuggestions(caseId: string): Promise<ResponseBody<CaseSummary[]>> {
  return get<CaseSummary[]>(`/orders-suggestions/${caseId}/`);
}

async function patchTransferOrder(
  data: FlexibleTransferOrderAction,
): Promise<ResponseBody<TransferOrder>> {
  return patch<TransferOrder>(`/orders/${data.id}`, data);
}

async function putConsolidationOrderApproval(
  data: ConsolidationOrderActionApproval,
): Promise<ResponseBody<ConsolidationOrder[]>> {
  return put<ConsolidationOrder[]>('/consolidations/approve', data);
}

async function putConsolidationOrderRejection(
  data: ConsolidationOrderActionRejection,
): Promise<ResponseBody<ConsolidationOrder[]>> {
  return put<ConsolidationOrder[]>('/consolidations/reject', data);
}

async function searchCases(predicate: CasesSearchPredicate): Promise<ResponseBody<CaseBasics[]>> {
  return post<CaseBasics[]>('/cases', predicate, {});
}

async function postStaffAssignments(action: StaffAssignmentAction): Promise<ResponseBody> {
  return post('/case-assignments', action, {});
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
  postStaffAssignments,
  putConsolidationOrderApproval,
  putConsolidationOrderRejection,
  searchCases,
};

export default MockApi2;
