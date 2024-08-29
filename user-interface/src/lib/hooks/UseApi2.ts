import { CaseAssignment } from '@common/cams/assignments';
import { CaseBasics, CaseDetail, CaseDocket, CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { Consolidation } from '@common/cams/events';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
  TransferOrder,
} from '@common/cams/orders';
import { CamsSession } from '@common/cams/session';
import { CaseHistory } from '@common/cams/history';
import { AttorneyUser } from '@common/cams/users';
import { CasesSearchPredicate } from '@common/api/search';
import { ObjectKeyVal } from '../type-declarations/basic';
import { ResponseBody } from '@common/api/response';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import LocalStorage from '../utils/local-storage';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';

// TODO: Deprecate use of the useApi hook.
// import { ApiClient } from './UseApi';

// interface ApiClient {
//   headers: Record<string, string>;
//   host: string;
//   createPath(path: string, params: ObjectKeyVal): string;
//   post(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody>;
//   get(path: string, options?: ObjectKeyVal): Promise<ResponseBody>;
//   patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody>;
//   put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody>;
//   getQueryStringsToPassthrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
// }

export interface ApiClient {
  headers: Record<string, string>;
  host: string;
  createPath(path: string, params: ObjectKeyVal): string;
  post(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  get(
    path: string,
    options?: ObjectKeyVal,
  ): Promise<ResponseData | SimpleResponseData | ResponseBody>;
  patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  getQueryStringsToPassthrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
}

function useApi(): ApiClient {
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const session = LocalStorage.getSession();
  api.headers['Authorization'] = `Bearer ${session?.accessToken}`;
  return api;
}

// export function useApi(): ApiClient {
//   const api = context ?? legacyConfiguration();
//   const session = LocalStorage.getSession();
//   api.headers['Authorization'] = `Bearer ${session?.accessToken}`;
//   return api;
// }

interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  patch<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  post<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  put<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
}

function extractPathFromUri(uriOrPath: string, api: ApiClient) {
  if (api.host.length > 0 && uriOrPath.startsWith(api.host)) {
    uriOrPath = uriOrPath.replace(api.host, '');
  }

  const paramsIndex = uriOrPath.search(/\?.*=/);
  if (paramsIndex >= 0) {
    uriOrPath = uriOrPath.substring(0, paramsIndex);
  }

  return uriOrPath;
}

function isResponseBody<T>(response: unknown): response is ResponseBody<T> {
  return !!response && typeof response === 'object' && 'data' in response;
}

function castToResponseBody<T>(response: unknown): ResponseBody<T> {
  if (isResponseBody<T>(response)) return response;
  throw new Error('Cannot map legacy response from API to new response model.');
}

// TODO: This should absorb `user-interface/src/lib/models/api.ts`
function useGenericApi(): GenericApiClient {
  const api = useApi();

  function justThePath(uriOrPath: string): string {
    return extractPathFromUri(uriOrPath, api);
  }

  return {
    async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>> {
      const body = await api.get(justThePath(path), options);
      return castToResponseBody(body);
    },
    async patch<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.patch(justThePath(path), body, options);
      return castToResponseBody(responseBody);
    },
    async post<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.post(justThePath(path), body, options);
      return castToResponseBody(responseBody);
    },
    async put<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.put(justThePath(path), body, options);
      return castToResponseBody(responseBody);
    },
  };
}
const api = useGenericApi;

async function getAttorneys() {
  return api().get<AttorneyUser[]>('/attorneys');
}

async function getCaseDetail(caseId: string) {
  return api().get<CaseDetail>(`/cases/${caseId}`);
}

async function getCaseDocket(caseId: string) {
  return api().get<CaseDocket>(`/cases/${caseId}/docket`);
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

async function getOrderSuggestions(caseId: string) {
  return api().get<CaseSummary[]>(`/orders-suggestions/${caseId}/`, {});
}

async function patchTransferOrder(data: FlexibleTransferOrderAction) {
  return api().patch<TransferOrder>(`/orders/${data.id}`, data);
}

async function putConsolidationOrderApproval(data: ConsolidationOrderActionApproval) {
  return api().put<ConsolidationOrder[]>('/consolidations/approve', data);
}

async function putConsolidationOrderRejection(data: ConsolidationOrderActionRejection) {
  return api().put<ConsolidationOrder[]>('/consolidations/reject', data);
}

async function searchCases(predicate: CasesSearchPredicate) {
  return api().post<CaseBasics[]>('/cases', predicate);
}

export const Api2 = {
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

// TODO: Deprecate this hook.
export function useApi2() {
  return Api2;
}

export default Api2;
