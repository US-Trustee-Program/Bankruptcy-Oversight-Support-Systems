import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
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
import LocalStorage from '../utils/local-storage';
import Api from './api';
import MockApi from '../testing/mock-api2';

interface ApiClient {
  headers: Record<string, string>;
  host: string;
  createPath(path: string, params: ObjectKeyVal): string;

  post(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody | void>;
  get(path: string, options?: ObjectKeyVal): Promise<ResponseBody>;
  patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody>;
  put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody>;
  getQueryStringsToPassThrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
}

interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>>;

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to PATCH requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @param path string The path after '/api'.
   * @param body object The payload for the request.
   * @param options ObjectKeyVal Query params in the form of key/value pairs.
   */
  patch<T = object>(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody<T> | void>;

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to POST requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @param path string The path after '/api'.
   * @param body object The payload for the request.
   * @param options ObjectKeyVal Query params in the form of key/value pairs.
   */
  post<T = object>(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody<T> | void>;
  put<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
}

export function extractPathFromUri(uriOrPath: string, api: ApiClient) {
  if (api.host.length > 0 && uriOrPath.startsWith(api.host)) {
    uriOrPath = uriOrPath.replace(api.host, '');
  }

  const paramsIndex = uriOrPath.search(/\?.*=/);
  if (paramsIndex >= 0) {
    uriOrPath = uriOrPath.substring(0, paramsIndex);
  }

  return uriOrPath;
}

export function addAuthHeaderToApi(): ApiClient {
  const api = Api;
  const session = LocalStorage.getSession();
  api.headers['Authorization'] = `Bearer ${session?.accessToken}`;
  return api;
}

// TODO: This should absorb `user-interface/src/lib/models/api.ts`
export function useGenericApi(): GenericApiClient {
  const api = addAuthHeaderToApi();

  function justThePath(uriOrPath: string): string {
    return extractPathFromUri(uriOrPath, api);
  }

  return {
    async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>> {
      const body = await api.get(justThePath(path), options);
      return body as ResponseBody<T>;
    },
    async patch<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T> | void> {
      const responseBody = await api.patch(justThePath(path), body, options);
      if (!responseBody) {
        return;
      }
      return responseBody as ResponseBody<T>;
    },
    async post<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T> | void> {
      const responseBody = await api.post(justThePath(path), body, options);
      if (!responseBody) {
        return;
      }
      return responseBody as ResponseBody<T>;
    },
    async put<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.put(justThePath(path), body, options);
      return responseBody as ResponseBody<T>;
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
  await api().patch<TransferOrder>(`/orders/${data.id}`, data);
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

async function postStaffAssignments(action: StaffAssignmentAction): Promise<void> {
  await api().post('/case-assignments', action);
}

export const _Api2 = {
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

export const Api2 = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : _Api2;

export default Api2;
