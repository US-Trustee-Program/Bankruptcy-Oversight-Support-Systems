import { CaseAssignment, StaffAssignmentAction } from '@common/cams/assignments';
import {
  CaseDetail,
  CaseDocket,
  CaseNote,
  CaseNoteInput,
  CaseSummary,
  SyncedCase,
} from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { UstpOfficeDetails } from '@common/cams/offices';
import { Consolidation } from '@common/cams/events';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  FlexibleTransferOrderAction,
  Order,
  TransferOrder,
  TransferOrderActionRejection,
} from '@common/cams/orders';
import { CamsSession } from '@common/cams/session';
import { CaseHistory } from '@common/cams/history';
import { AttorneyUser, CamsUserReference, PrivilegedIdentityUser } from '@common/cams/users';
import { CasesSearchPredicate } from '@common/api/search';
import { ObjectKeyVal } from '../type-declarations/basic';
import { ResponseBody } from '@common/api/response';
import LocalStorage from '../utils/local-storage';
import Api from './api';
import MockApi2 from '../testing/mock-api2';
import LocalCache from '../utils/local-cache';
import { DAY, MINUTE } from '../utils/datetime';
import { sanitizeText } from '../utils/sanitize-text';
import { isValidUserInput } from '../../../../common/src/cams/sanitization';
import {
  ElevatePrivilegedUserAction,
  RoleAndOfficeGroupNames,
} from '../../../../common/src/cams/privileged-identity';
import { CamsPaginationResponse } from '@common/api/pagination';

interface ApiClient {
  headers: Record<string, string>;
  host: string;
  createPath(path: string, params: ObjectKeyVal): string;

  post(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody | void>;
  get(path: string, options?: ObjectKeyVal): Promise<ResponseBody>;
  delete(path: string): Promise<ResponseBody | void>;
  patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody | void>;
  put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody | void>;
  getQueryStringsToPassThrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
}

interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  delete<T = object>(path: string): Promise<ResponseBody<T>>;

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to PATCH requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @template {T extends object = object} T
   * @template {U extends object = object} U
   * @param {string} path The path after '/api'.
   * @param {U} body The payload for the request.
   * @param {ObjectKeyVal} [options] Query params in the form of key/value pairs.
   * @returns {Promise<ResponseBody | void>}
   */
  patch<T extends object = object, U extends object = object>(
    path: string,
    body: U,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody<T> | void>;

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to POST requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @template {T extends object = object} T
   * @template {U extends object = object} U
   * @param {string} path The path after '/api'.
   * @param {U} body The payload for the request.
   * @param {ObjectKeyVal} [options] Query params in the form of key/value pairs.
   * @returns {Promise<ResponseBody | void>}
   */
  post<T extends object = object, U extends object = object>(
    path: string,
    body: U,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody<T> | void>;

  put<T extends object = object, U extends object = object>(
    path: string,
    body: U,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody<T>>;
}

export function extractPathFromUri(uriOrPath: string, api: ApiClient) {
  if (api.host.length > 0 && uriOrPath.startsWith(api.host)) {
    uriOrPath = uriOrPath.replace(api.host, '');
  }

  const paramsIndex = uriOrPath.search(/\?.*=/);
  const queryParams: ObjectKeyVal = {};
  let uriOrPathSubstring: string = '' + uriOrPath;
  if (paramsIndex >= 0) {
    uriOrPathSubstring = uriOrPath.substring(0, paramsIndex);
    const queryParamString = uriOrPath.substring(paramsIndex + 1).split('&');
    queryParamString.forEach((param) => {
      const splitParams = param.split('=');
      queryParams[splitParams[0]] = splitParams[1];
    });
  }

  return { uriOrPathSubstring, queryParams };
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

  function justThePath(uriOrPath: string): {
    uriOrPathSubstring: string;
    queryParams: ObjectKeyVal;
  } {
    return extractPathFromUri(uriOrPath, api);
  }

  return {
    async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>> {
      const { uriOrPathSubstring, queryParams } = justThePath(path);
      options = { ...options, ...queryParams };
      const body = await api.get(uriOrPathSubstring, options);
      return body as ResponseBody<T>;
    },

    async delete<T = object>(path: string): Promise<ResponseBody<T>> {
      const { uriOrPathSubstring } = justThePath(path);
      const body = await api.delete(uriOrPathSubstring);
      return body as ResponseBody<T>;
    },

    async patch<T extends object = object, U extends object = object>(
      path: string,
      body: U,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T> | void> {
      const { uriOrPathSubstring, queryParams } = justThePath(path);
      options = { ...options, ...queryParams };
      const responseBody = await api.patch(uriOrPathSubstring, body, options);
      if (!responseBody) {
        return;
      }
      return responseBody as ResponseBody<T>;
    },

    async post<T extends object = object, U extends object = object>(
      path: string,
      body: U,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T> | void> {
      const { uriOrPathSubstring, queryParams } = justThePath(path);
      options = { ...options, ...queryParams };
      const responseBody = await api.post(uriOrPathSubstring, body, options);
      if (!responseBody) {
        return;
      }
      return responseBody as ResponseBody<T>;
    },

    async put<T extends object = object, U extends object = object>(
      path: string,
      body: U,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const { uriOrPathSubstring, queryParams } = justThePath(path);
      options = { ...options, ...queryParams };
      const responseBody = await api.put(uriOrPathSubstring, body, options);
      return responseBody as ResponseBody<T>;
    },
  };
}

const api = useGenericApi;

type CacheOptions = {
  key: string;
  ttl?: number;
};

function withCache(cacheOptions: CacheOptions): Pick<GenericApiClient, 'get'> {
  // TODO: For now we are only implementing `get`. In the future we may want to cache responses from the other HTTP verbs.
  return {
    get: async function <T = object>(
      path: string,
      options: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      if (LocalCache.isCacheEnabled()) {
        const cached = LocalCache.get<ResponseBody<T>>(cacheOptions.key);
        if (cached) {
          return Promise.resolve(cached);
        } else {
          const response = await api().get<T>(path, options);
          LocalCache.set<ResponseBody<T>>(cacheOptions.key, response, cacheOptions.ttl);
          return Promise.resolve(response);
        }
      } else {
        return api().get<T>(path, options);
      }
    },
  };
}

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

async function getCaseNotes(caseId: string) {
  return api().get<CaseNote[]>(`/cases/${caseId}/notes`);
}

async function postCaseNote(note: CaseNoteInput): Promise<void> {
  const sanitizedNote = sanitizeText(note.content);
  const sanitizedTitle = sanitizeText(note.title);
  if (sanitizedNote.length > 0 && sanitizedTitle.length > 0 && isValidUserInput(sanitizedNote)) {
    await api().post<CaseNoteInput>(`/cases/${note.caseId}/notes`, {
      title: sanitizedTitle,
      content: sanitizedNote,
    });
  }
}

async function getCourts() {
  const path = `/courts`;
  return withCache({ key: path, ttl: DAY }).get<CourtDivisionDetails[]>(path);
}

async function getMe() {
  return api().get<CamsSession>(`/me`);
}

async function getOfficeAttorneys(officeCode: string) {
  const path = `/offices/${officeCode}/attorneys`;
  return withCache({ key: path }).get<AttorneyUser[]>(path);
}

async function getOffices() {
  const path = `/offices`;
  return withCache({ key: path, ttl: DAY }).get<UstpOfficeDetails[]>(path);
}

async function getOrders() {
  return api().get<Order[]>(`/orders`, {});
}

async function getOrderSuggestions(caseId: string) {
  return api().get<CaseSummary[]>(`/orders-suggestions/${caseId}/`, {});
}

async function patchTransferOrderApproval(data: Partial<FlexibleTransferOrderAction>) {
  await api().patch<TransferOrder, FlexibleTransferOrderAction>(`/orders/${data.id}`, data);
}

async function patchTransferOrderRejection(data: Partial<TransferOrderActionRejection>) {
  if (data.reason && isValidUserInput(data.reason)) {
    data.reason = sanitizeText(data.reason);
    await api().patch<TransferOrder, FlexibleTransferOrderAction>(`/orders/${data.id}`, data);
  }
}

async function putConsolidationOrderApproval(data: ConsolidationOrderActionApproval) {
  return api().put<ConsolidationOrder[], ConsolidationOrderActionApproval>(
    '/consolidations/approve',
    data,
  );
}

async function putConsolidationOrderRejection(data: ConsolidationOrderActionRejection) {
  if (data.reason && isValidUserInput(data.reason)) {
    data.reason = sanitizeText(data.reason);
    return api().put<ConsolidationOrder[], ConsolidationOrderActionRejection>(
      '/consolidations/reject',
      data,
    );
  }
}

async function searchCases(
  predicate: CasesSearchPredicate,
  options: { includeAssignments?: boolean } = {},
) {
  return api().post<CamsPaginationResponse<SyncedCase>, CasesSearchPredicate>(
    '/cases',
    predicate,
    options,
  );
}

async function postStaffAssignments(action: StaffAssignmentAction) {
  await api().post('/case-assignments', action);
}

async function getRoleAndOfficeGroupNames() {
  const path = '/dev-tools/privileged-identity/groups';
  return withCache({ key: path, ttl: MINUTE * 15 }).get<RoleAndOfficeGroupNames>(path);
}

async function getPrivilegedIdentityUsers() {
  const path = '/dev-tools/privileged-identity';
  return withCache({ key: path, ttl: MINUTE * 15 }).get<CamsUserReference[]>(path);
}

async function getPrivilegedIdentityUser(userId: string) {
  const path = `/dev-tools/privileged-identity/${userId}`;
  return withCache({ key: path, ttl: MINUTE * 15 }).get<PrivilegedIdentityUser>(path);
}

async function putPrivilegedIdentityUser(userId: string, action: ElevatePrivilegedUserAction) {
  await api().put(`/dev-tools/privileged-identity/${userId}`, action);
}

async function deletePrivilegedIdentityUser(userId: string) {
  await api().delete(`/dev-tools/privileged-identity/${userId}`);
}

export const _Api2 = {
  deletePrivilegedIdentityUser,
  getAttorneys,
  getCaseDetail,
  getCaseDocket,
  getCaseSummary,
  getCaseAssignments,
  getCaseAssociations,
  getCaseHistory,
  postCaseNote,
  getCaseNotes,
  getCourts,
  getMe,
  getOfficeAttorneys,
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

export const Api2 = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi2 : _Api2;

export default Api2;
