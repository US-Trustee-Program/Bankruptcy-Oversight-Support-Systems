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
import { Creatable } from '@common/cams/creatable';
import { BankListItem, BankruptcySoftwareListItem } from '@common/cams/lists';
import { OversightRole } from '@common/cams/roles';

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
      throw new Error('api error');
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
    return { data: created } as ResponseBody<T>;
  } else {
    throw new Error();
  }
}

async function get<T = unknown>(path: string): Promise<ResponseBody<T>> {
  let response: ResponseBody<unknown>;
  if (path.match(/\/cases\/123-12-12345\/docket/)) {
    throw new Error();
  } else if (path.match(/\/cases\/001-77-77777\/summary/)) {
    throw new Error('Case summary not found for the case ID.');
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
    // } else if (path.match(/\/offices\/.*\/attorneys/)) {
    //   response = {
    //     data: MockData.buildArray(MockData.getAttorneyUser, 5),
    //   };
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
      data: courts.map((c) => {
        if (c.state === undefined) {
          return { ...c, state: '' };
        }
        return c;
      }),
    };
  } else if (path.match(/\/trustees\/[A-Z\d-]+/i)) {
    response = {
      data: MockData.getTrustee({
        id: 'trustee-1',
      }),
    };
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
  } else if (path === '/staff') {
    response = {
      data: [
        ...MockData.buildArray(MockData.getAttorneyUser, 3),
        ...MockData.buildArray(MockData.getAuditorUser, 2),
      ],
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

  return response as ResponseBody<T>;
}

async function patch<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return response as ResponseBody<T>;
}

async function put<T = unknown>(
  _path: string,
  data: object,
  _options?: ObjectKeyVal,
): Promise<ResponseBody<T>> {
  const response = {
    data,
  };
  return response as ResponseBody<T>;
}

async function _delete<T = unknown>(_path: string): Promise<ResponseBody<T>> {
  const response = {
    data: null,
  };
  return response as ResponseBody<T>;
}

async function getOversightStaff(): Promise<ResponseBody<Staff[]>> {
  return get<Staff[]>('/staff');
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
  return;
}

async function patchTransferOrderRejection(_data: FlexibleTransferOrderAction): Promise<void> {
  return;
}

async function getCaseNotes(caseId: string): Promise<ResponseBody<CaseNote[]>> {
  return get<CaseNote[]>(`/cases/${caseId}/notes`);
}

async function deleteCaseNote(_note: Partial<CaseNote>) {
  return;
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

async function patchTrustee(id: string, trustee: Partial<TrusteeInput>) {
  return patch(`/trustees/${id}`, trustee, {}) as unknown as Promise<ResponseBody<Trustee>>;
}

async function getTrustees() {
  return get<Trustee[]>('/trustees');
}

async function getTrustee(id: string) {
  return get<Trustee>(`/trustees/${id}`);
}

async function getTrusteeHistory(_ignore: string) {
  return {
    data: MockData.getTrusteeHistory(),
  };
}

async function getBankruptcySoftwareList() {
  return {
    data: [
      {
        _id: '1',
        list: 'bankruptcy-software',
        key: 'Axos',
        value: 'Axos',
      },
      {
        _id: '2',
        list: 'bankruptcy-software',
        key: 'BlueStylus',
        value: 'BlueStylus',
      },
      {
        _id: '3',
        list: 'bankruptcy-software',
        key: 'Epiq',
        value: 'Epiq',
      },
    ],
  };
}

async function postBankruptcySoftware(_ignore: Creatable<BankruptcySoftwareListItem>) {
  return '--id--';
}

async function deleteBankruptcySoftware(_ignore: string) {
  return;
}

async function getBanks() {
  return {
    data: [
      {
        _id: '1',
        list: 'banks',
        key: 'Bank of America',
        value: 'Bank of America',
      },
      {
        _id: '2',
        list: 'banks',
        key: 'Chase Bank',
        value: 'Chase Bank',
      },
      {
        _id: '3',
        list: 'banks',
        key: 'Wells Fargo',
        value: 'Wells Fargo',
      },
    ],
  };
}

async function postBank(_ignore: Creatable<BankListItem>) {
  return '--id--';
}

async function deleteBank(_ignore: string) {
  return;
}

async function getTrusteeOversightAssignments(trusteeId: string) {
  return {
    data: [
      {
        id: 'assignment-1',
        trusteeId,
        user: {
          id: 'attorney-1',
          name: 'John Doe',
        },
        role: OversightRole.OversightAttorney,
        createdBy: { id: 'user-1', name: 'Admin User' },
        createdOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
        updatedOn: '2023-01-01T00:00:00Z',
      },
    ],
  };
}

async function createTrusteeOversightAssignment(
  trusteeId: string,
  userId: string,
  role: OversightRole,
) {
  return {
    data: {
      id: MockData.randomId(),
      trusteeId,
      user: {
        id: userId,
        name: 'John Doe',
      },
      role,
      createdBy: { id: 'user-1', name: 'Admin User' },
      createdOn: new Date().toISOString(),
      updatedBy: { id: 'user-1', name: 'Admin User' },
      updatedOn: new Date().toISOString(),
    },
  };
}

const MockApi2 = {
  getTrustees,
  getTrustee,
  getTrusteeHistory,
  postTrustee,
  patchTrustee,
  deletePrivilegedIdentityUser,
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
  getBankruptcySoftwareList,
  postBankruptcySoftware,
  deleteBankruptcySoftware,
  deleteBank,
  postBank,
  getBanks,
  getTrusteeOversightAssignments,
  createTrusteeOversightAssignment,
  getOversightStaff,
};

export default MockApi2;
