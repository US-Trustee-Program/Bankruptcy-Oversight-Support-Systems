import { ResponseBody } from '@common/api/response';
import { ObjectKeyVal } from '../type-declarations/basic';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions, { ResourceActions } from '@common/cams/actions';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import {
  CaseBasics,
  CaseDetail,
  CaseDocket,
  CaseNote,
  CaseNoteInput,
  CaseSummary,
  SyncedCase,
} from '@common/cams/cases';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { AttorneyUser, CamsUserReference, PrivilegedIdentityUser, Staff } from '@common/cams/users';
import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
import { CaseHistory } from '@common/cams/history';
import { CamsSession } from '@common/cams/session';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
} from '@common/cams/orders';
import { CasesSearchPredicate } from '@common/api/search';
import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '@common/cams/offices';
import {
  ElevatePrivilegedUserAction,
  RoleAndOfficeGroupNames,
} from '@common/cams/privileged-identity';
import { Trustee, TrusteeInput } from '@common/cams/trustees';

const caseDocketEntries = MockData.buildArray(MockData.getDocketEntry, 5);
const caseNoteGuids = [
  '86531537-2350-463B-A28F-F218E122B458',
  'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  '12345678-90AB-CDEF-1234-567890ABCDEF',
  'FEDCBA98-7654-3210-FEDC-BA9876543210',
  '11223344-5566-7788-99AA-BBCCDDEEFF00',
];
const caseNotes = caseNoteGuids.map((guid) =>
  MockData.getCaseNote({ caseId: '101-12-12345', id: guid }),
);

const resourceActionCaseNotes = caseNotes.map((note) => {
  return {
    ...note,
    _actions: [Actions.EditNote, Actions.RemoveNote],
  };
});
const caseActions = [Actions.ManageAssignments];
const caseDetails = MockData.getCaseDetail({
  override: {
    _actions: caseActions,
    chapter: '15',
    caseTitle: 'Test Case Title',
    petitionLabel: 'Voluntary',
    caseId: '101-12-12345',
    trustee: MockData.getLegacyTrustee(),
  },
});
const courts = MockData.getCourts().slice(0, 5);

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
  } else if (path.match(/^\/trustees$/)) {
    const input = body as TrusteeInput;
    const created: Trustee = {
      ...input,
      id: MockData.randomId(),
      createdBy: { id: 'user-1', name: 'Mock User' },
      createdOn: new Date().toISOString(),
      lastUpdatedBy: { id: 'user-1', name: 'Mock User' },
      lastUpdatedOn: new Date().toISOString(),
    } as unknown as Trustee;
    return Promise.resolve({ data: created } as ResponseBody<T>);
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
  } else if (path.match(/\/cases\/[A-Z\d-]+\/docket/)) {
    response = {
      data: caseDocketEntries,
    };
  } else if (path.match(/\/cases\/[A-Z\d-]+\/notes/)) {
    response = {
      data: resourceActionCaseNotes,
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
        roles: [],
        offices: [],
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
  } else if (path.match(/\/trustees\/[A-Z\d-]+/i)) {
    response = {
      data: MockData.getTrustee({
        id: 'trustee-1',
        districts: ['710', '720'],
        chapters: ['11', '7-non-panel'],
      }),
    };
    console.log(response);
  } else if (path.match(/\/trustees/)) {
    response = {
      data: [
        MockData.getLegacyTrustee({ name: 'John Doe' }),
        MockData.getLegacyTrustee({ name: 'Jane Smith' }),
        MockData.getLegacyTrustee({ name: 'Bob Johnson' }),
      ],
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

async function _delete<T = unknown>(_path: string): Promise<ResponseBody<T>> {
  const response = {
    data: null,
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

async function getCourts(): Promise<ResponseBody<CourtDivisionDetails[]>> {
  return get<CourtDivisionDetails[]>(`/courts`);
}

async function getMe(): Promise<ResponseBody<CamsSession>> {
  return get<CamsSession>(`/me`);
}

async function getOfficeAttorneys(officeCode: string) {
  return get<AttorneyUser[]>(`/offices/${officeCode}/attorneys`);
}

async function getOfficeAssignees(officeCode: string) {
  return get<Staff[]>(`/offices/${officeCode}/assignees`);
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

async function patchTransferOrderApproval(_data: FlexibleTransferOrderAction): Promise<void> {
  return Promise.resolve();
}

async function patchTransferOrderRejection(_data: FlexibleTransferOrderAction): Promise<void> {
  return Promise.resolve();
}

async function getCaseNotes(caseId: string): Promise<ResponseBody<CaseNote[]>> {
  return get<CaseNote[]>(`/cases/${caseId}/notes`);
}

async function deleteCaseNote(_note: Partial<CaseNote>) {
  return Promise.resolve();
}

async function postCaseNote(note: CaseNoteInput): Promise<void> {
  await post(`/cases/${note.caseId}/notes`, { note }, {});
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

async function searchCases(
  predicate: CasesSearchPredicate,
  options: { includeAssignments?: boolean } = {},
): Promise<ResponseBody<SyncedCase[]>> {
  return post<SyncedCase[]>('/cases', predicate, options);
}

async function postStaffAssignments(action: StaffAssignmentAction): Promise<ResponseBody> {
  return post('/case-assignments', action, {});
}

async function getRoleAndOfficeGroupNames() {
  return get<RoleAndOfficeGroupNames>('/dev-tools/privileged-identity/groups');
}

async function getPrivilegedIdentityUsers() {
  return get<CamsUserReference[]>('/dev-tools/privileged-identity');
}

async function getPrivilegedIdentityUser(userId: string) {
  return get<PrivilegedIdentityUser>(`/dev-tools/privileged-identity/${userId}`);
}

async function putPrivilegedIdentityUser(userId: string, action: ElevatePrivilegedUserAction) {
  await put(`/dev-tools/privileged-identity/${userId}`, action);
}

async function deletePrivilegedIdentityUser(userId: string) {
  await _delete(`/dev-tools/privileged-identity/${userId}`);
}

async function postTrustee(trustee: TrusteeInput) {
  return post('/trustees', trustee, {}) as unknown as Promise<ResponseBody<Trustee>>;
}

async function getTrustees() {
  return get<Trustee[]>('/trustees');
}

async function getTrustee(id: string) {
  return get<Trustee>(`/trustees/${id}`);
}

export const MockApi2 = {
  getTrustees,
  getTrustee,
  postTrustee,
  deletePrivilegedIdentityUser,
  getAttorneys,
  getCaseDetail,
  getCaseDocket,
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getCaseHistory,
  postCaseNote,
  putCaseNote,
  getCaseNotes,
  deleteCaseNote,
  getCourts,
  getMe,
  getOfficeAttorneys,
  getOfficeAssignees,
  getOffices,
  getOrders,
  getOrderSuggestions,
  getPrivilegedIdentityUsers,
  getPrivilegedIdentityUser,
  getRoleAndOfficeGroupNames,
  patchTransferOrderApproval,
  patchTransferOrderRejection,
  postStaffAssignments,
  putConsolidationOrderApproval,
  putConsolidationOrderRejection,
  putPrivilegedIdentityUser,
  searchCases,
};

export default MockApi2;
