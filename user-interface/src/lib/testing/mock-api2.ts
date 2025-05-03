import { ResponseBody } from '@common/api/response';
import { CasesSearchPredicate } from '@common/api/search';
import Actions, { ResourceActions } from '@common/cams/actions';
import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
import {
  CaseBasics,
  CaseDetail,
  CaseDocket,
  CaseNote,
  CaseNoteInput,
  CaseSummary,
  SyncedCase,
} from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { CaseHistory } from '@common/cams/history';
import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '@common/cams/offices';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
} from '@common/cams/orders';
import {
  ElevatePrivilegedUserAction,
  RoleAndOfficeGroupNames,
} from '@common/cams/privileged-identity';
import { CamsSession } from '@common/cams/session';
import MockData from '@common/cams/test-utilities/mock-data';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { AttorneyUser, CamsUserReference, PrivilegedIdentityUser, Staff } from '@common/cams/users';

import { ObjectKeyVal } from '../type-declarations/basic';

const caseDocketEntries = MockData.buildArray(MockData.getDocketEntry, 5);
const caseNotes = MockData.buildArray(() => MockData.getCaseNote({ caseId: '101-12-12345' }), 5);
const caseActions = [Actions.ManageAssignments];
const caseDetails = MockData.getCaseDetail({
  override: {
    _actions: caseActions,
    caseTitle: 'Test Case Title',
    chapter: '15',
    petitionLabel: 'Voluntary',
  },
});
const courts = MockData.getCourts().slice(0, 5);

// Consolidated Lead Case
const consolidationLeadCaseId = '999-99-00001';
const consolidationLeadCaseSummary = MockData.getCaseSummary({
  override: { caseId: consolidationLeadCaseId },
});
const consolidation: Array<ConsolidationFrom | ConsolidationTo> = [
  MockData.getConsolidationReference({
    override: {
      documentType: 'CONSOLIDATION_TO',
      otherCase: consolidationLeadCaseSummary,
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
      leadCase: {
        ...consolidationLeadCaseSummary,
      },
      orderDate: '2024-05-01',
      status: 'approved',
    },
  }),
  MockData.getConsolidationOrder({
    override: {
      id: 'guid-5',
      orderDate: '2024-06-01',
      reason: 'This is a rejection reason.',
      status: 'rejected',
    },
  }),
];

async function _delete<T = unknown>(_path: string): Promise<ResponseBody<T>> {
  const response = {
    data: null,
  };
  return Promise.resolve(response as ResponseBody<T>);
}

async function _patch<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return Promise.resolve(response as ResponseBody<T>);
}

async function deleteCaseNote(_note: Partial<CaseNote>) {
  return Promise.resolve();
}

async function deletePrivilegedIdentityUser(userId: string) {
  await _delete(`/dev-tools/privileged-identity/${userId}`);
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
  } else if (path.match(/\/cases\/[A-Z\d-]+\/docket/)) {
    response = {
      data: caseDocketEntries,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/notes/)) {
    response = {
      data: caseNotes,
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
  } else if (path.match(/\/dev-tools\/privileged-identity\/groups/)) {
    response = {
      data: {
        offices: [],
        roles: [],
      },
    };
  } else if (path.match(/\/orders-suggestions\/[A-Z\d-]+/)) {
    response = {
      data: [caseDetails],
    };
  } else if (path.match(/\/orders/)) {
    response = {
      data: orders,
    };
  } else if (path.match(/\/offices\/.*\/attorneys/)) {
    response = {
      data: MockData.buildArray(MockData.getAttorneyUser, 5),
    };
  } else if (path.match(/\/offices\/.*\/assignees/)) {
    response = {
      data: MockData.buildArray(MockData.getStaffAssignee, 5),
    };
  } else if (path.match(/\/offices/)) {
    response = {
      data: MOCKED_USTP_OFFICES_ARRAY,
    };
  } else if (path.match(/\/courts/)) {
    response = {
      data: courts,
    };
  } else if (path.match(/\/me/)) {
    response = {
      data: MockData.getCamsSession({ user: SUPERUSER.user }),
    };
  } else if (path.match(/\/cases\/999-99-00001/)) {
    response = {
      data: {
        ...consolidationLeadCase,
        consolidation,
      },
    };
  } else {
    response = {
      data: {},
    };
  }

  return Promise.resolve(response as ResponseBody<T>);
}

async function getAttorneys(): Promise<ResponseBody<AttorneyUser[]>> {
  return get<AttorneyUser[]>('/attorneys');
}

async function getCaseAssignments(caseId: string): Promise<ResponseBody<CaseAssignment[]>> {
  return get<CaseAssignment[]>(`/case-assignments/${caseId}`);
}

async function getCaseAssociations(caseId: string): Promise<ResponseBody<Consolidation[]>> {
  return get<Consolidation[]>(`/cases/${caseId}/associated`);
}

async function getCaseDetail(caseId: string): Promise<ResponseBody<CaseDetail>> {
  return get<CaseDetail>(`/cases/${caseId}`);
}

async function getCaseDocket(caseId: string): Promise<ResponseBody<CaseDocket>> {
  return get<CaseDocket>(`/cases/${caseId}/docket`);
}

async function getCaseHistory(caseId: string): Promise<ResponseBody<CaseHistory[]>> {
  return get<CaseHistory[]>(`/cases/${caseId}/history`);
}

async function getCaseNotes(caseId: string): Promise<ResponseBody<CaseNote[]>> {
  return get<CaseNote[]>(`/cases/${caseId}/notes`);
}

async function getCaseSummary(caseId: string): Promise<ResponseBody<CaseSummary>> {
  return get<CaseSummary>(`/cases/${caseId}/summary`);
}

async function getCourts(): Promise<ResponseBody<CourtDivisionDetails[]>> {
  return get<CourtDivisionDetails[]>(`/courts`);
}

async function getMe(): Promise<ResponseBody<CamsSession>> {
  return get<CamsSession>(`/me`);
}

async function getOfficeAssignees(officeCode: string) {
  return get<Staff[]>(`/offices/${officeCode}/assignees`);
}

async function getOfficeAttorneys(officeCode: string) {
  return get<AttorneyUser[]>(`/offices/${officeCode}/attorneys`);
}

async function getOffices(): Promise<ResponseBody<UstpOfficeDetails[]>> {
  return get<UstpOfficeDetails[]>(`/offices`);
}

async function getOrders(): Promise<ResponseBody<Order[]>> {
  return get<Order[]>(`/orders`);
}

async function getOrderSuggestions(caseId: string): Promise<ResponseBody<CaseSummary[]>> {
  return get<CaseSummary[]>(`/orders-suggestions/${caseId}/`);
}

async function getPrivilegedIdentityUser(userId: string) {
  return get<PrivilegedIdentityUser>(`/dev-tools/privileged-identity/${userId}`);
}

async function getPrivilegedIdentityUsers() {
  return get<CamsUserReference[]>('/dev-tools/privileged-identity');
}

async function getRoleAndOfficeGroupNames() {
  return get<RoleAndOfficeGroupNames>('/dev-tools/privileged-identity/groups');
}

async function patchTransferOrderApproval(_data: FlexibleTransferOrderAction): Promise<void> {
  return Promise.resolve();
}

async function patchTransferOrderRejection(_data: FlexibleTransferOrderAction): Promise<void> {
  return Promise.resolve();
}

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
        {
          ...MockData.getCaseBasics({
            override: { caseId: `011-${caseNumber ?? MockData.randomCaseNumber()}` },
          }),
          _actions,
        },
        {
          ...MockData.getCaseBasics({
            override: { caseId: `070-${caseNumber ?? MockData.randomCaseNumber()}` },
          }),
          _actions,
        },
        {
          ...MockData.getCaseBasics({
            override: { caseId: `132-${caseNumber ?? MockData.randomCaseNumber()}` },
          }),
          _actions,
        },
        {
          ...MockData.getCaseBasics({
            override: { caseId: `3E1-${caseNumber ?? MockData.randomCaseNumber()}` },
          }),
          _actions,
        },
        {
          ...MockData.getCaseBasics({
            override: { caseId: `256-${caseNumber ?? MockData.randomCaseNumber()}` },
          }),
          _actions,
        },
      ];
    }
    return response as ResponseBody<ResourceActions<T>>;
  } else {
    return Promise.reject(new Error());
  }
}

async function postCaseNote(note: CaseNoteInput): Promise<void> {
  await post(`/cases/${note.caseId}/notes`, { note }, {});
}

async function postStaffAssignments(action: StaffAssignmentAction): Promise<ResponseBody> {
  return post('/case-assignments', action, {});
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

async function putCaseNote(_note: CaseNoteInput): Promise<string | undefined> {
  return MockData.randomId();
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

async function putPrivilegedIdentityUser(userId: string, action: ElevatePrivilegedUserAction) {
  await put(`/dev-tools/privileged-identity/${userId}`, action);
}

async function searchCases(
  predicate: CasesSearchPredicate,
  options: { includeAssignments?: boolean } = {},
): Promise<ResponseBody<SyncedCase[]>> {
  return post<SyncedCase[]>('/cases', predicate, options);
}

export const MockApi2 = {
  deleteCaseNote,
  deletePrivilegedIdentityUser,
  getAttorneys,
  getCaseAssignments,
  getCaseAssociations,
  getCaseDetail,
  getCaseDocket,
  getCaseHistory,
  getCaseNotes,
  getCaseSummary,
  getCourts,
  getMe,
  getOfficeAssignees,
  getOfficeAttorneys,
  getOffices,
  getOrders,
  getOrderSuggestions,
  getPrivilegedIdentityUser,
  getPrivilegedIdentityUsers,
  getRoleAndOfficeGroupNames,
  patchTransferOrderApproval,
  patchTransferOrderRejection,
  postCaseNote,
  postStaffAssignments,
  putCaseNote,
  putConsolidationOrderApproval,
  putConsolidationOrderRejection,
  putPrivilegedIdentityUser,
  searchCases,
};

export default MockApi2;
