import { ResponseBody } from '@common/api/response';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import { ObjectKeyVal } from '../type-declarations/basic';
import { LocalStorage } from '../utils/local-storage';

let context: ApiClient;

/**
 * Factory function returning an API client instance based on legacy environment variable setting.
 *
 * @returns ApiClient
 */
function legacyConfiguration(): ApiClient {
  return import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
}

/**
 * Allows the module scoped API context to be set or overridden.
 *
 * @param api ApiClient
 */
export function setApiContext(api: ApiClient) {
  context = api;
}

/**
 * React hook providing access to the module scoped API instance.
 *
 * @returns ApiClient
 */
export function useApi(): ApiClient {
  const api = context ?? legacyConfiguration();
  const session = LocalStorage.getSession();
  api.headers['Authorization'] = `Bearer ${session?.accessToken}`;
  return api;
}

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

export interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  post<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
  put<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseBody<T>>;
}

//This allows us to use generics and avoid typing using the "as" keyword to specify return types throughout the rest of the application
// TODO: Need to better handle non-200 responses.
// e.g. a 202 or 204 would result in an error.
// We are also swallowing any meaningful error responses.

function isLegacyResponseData(response: unknown): response is { body: unknown } {
  return !!response && typeof response === 'object' && 'body' in response;
}

function isResponseBody<T>(response: unknown): response is ResponseBody<T> {
  return !!response && typeof response === 'object' && 'data' in response;
}

export function mapFromLegacyToResponseBody<T>(response: unknown): ResponseBody<T> {
  if (isResponseBody<T>(response)) return response;
  if (isLegacyResponseData(response)) {
    return {
      data: response.body as T,
    };
  }
  throw new Error('Cannot map legacy response from API to new response model.');
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

export function useGenericApi(): GenericApiClient {
  const api = useApi();

  function justThePath(uriOrPath: string): string {
    return extractPathFromUri(uriOrPath, api);
  }

  return {
    async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>> {
      const body = await api.get(justThePath(path), options);
      return mapFromLegacyToResponseBody(body);
    },
    async post<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.post(justThePath(path), body, options);
      return mapFromLegacyToResponseBody(responseBody);
    },
    async put<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBody<T>> {
      const responseBody = await api.put(justThePath(path), body, options);
      return mapFromLegacyToResponseBody(responseBody);
    },
  };
}
