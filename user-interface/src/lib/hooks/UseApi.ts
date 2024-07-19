import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import { ObjectKeyVal } from '../type-declarations/basic';
import {
  buildResponseBodySuccess,
  isResponseBodyError,
  isResponseBodySuccess,
  ResponseBody,
  ResponseBodySuccess,
} from '@common/api/response';
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
  list(path: string, options?: ObjectKeyVal): Promise<ResponseData>;
  get(
    path: string,
    options?: ObjectKeyVal,
  ): Promise<ResponseData | SimpleResponseData | ResponseBody>;
  patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  getQueryStringsToPassthrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
}

export interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBodySuccess<T>>;
  post<T = object>(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBodySuccess<T>>;
  put<T = object>(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBodySuccess<T>>;
}

//This allows us to use generics and avoid typing using the "as" keyword to specify return types throughout the rest of the application
// TODO: Need to better handle non-200 responses.
// e.g. a 202 or 204 would result in an error.
// We are also swallowing any meaningful error responses.

function isLegacyResponseData(response: unknown): response is { body: unknown } {
  return !!response && typeof response === 'object' && 'body' in response;
}

function mapFromLegacyToResponseBody<T>(response: unknown): ResponseBodySuccess<T> {
  if (isResponseBodySuccess<T>(response)) return response;
  if (isResponseBodyError(response)) {
    throw new Error('TBD Need to map the error from the response body');
  }
  if (isLegacyResponseData(response)) {
    return buildResponseBodySuccess<T>(response.body as T, {
      isPaginated: false,
      self: '',
    });
  }
  throw new Error('Cannot map legacy response from API to new response model.');
}

export function useGenericApi(): GenericApiClient {
  const api = useApi();

  function justThePath(uriOrPath: string): string {
    if (uriOrPath.startsWith(api.host)) {
      return uriOrPath.replace(api.host, '');
    }
    return uriOrPath;
  }

  return {
    async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBodySuccess<T>> {
      const body = await api.get(justThePath(path), options);
      return mapFromLegacyToResponseBody(body);
    },
    async post<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBodySuccess<T>> {
      const responseBody = await api.post(justThePath(path), body, options);
      return mapFromLegacyToResponseBody(responseBody);
    },
    async put<T = object>(
      path: string,
      body: object,
      options?: ObjectKeyVal,
    ): Promise<ResponseBodySuccess<T>> {
      const responseBody = await api.put(justThePath(path), body, options);
      return mapFromLegacyToResponseBody(responseBody);
    },
  };
}
