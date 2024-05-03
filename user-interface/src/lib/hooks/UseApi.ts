import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import { ObjectKeyVal } from '../type-declarations/basic';

// TODO: Possibly use the React Context API to scope the API context to the DOM rather than the module. Add a provider component to configure the API context.
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
  return context ?? legacyConfiguration();
}

export interface ApiClient {
  createPath(path: string, params: ObjectKeyVal): string;
  post(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  list(path: string, options?: ObjectKeyVal): Promise<ResponseData>;
  get(path: string, options?: ObjectKeyVal): Promise<ResponseData | SimpleResponseData>;
  patch(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  put(path: string, body: object, options?: ObjectKeyVal): Promise<ResponseData>;
  getQueryStringsToPassthrough(search: string, options: ObjectKeyVal): ObjectKeyVal;
}

export interface GenericApiClient {
  get<T = object>(path: string, options?: ObjectKeyVal): Promise<T>;
  post<T = object>(path: string, body: object, options?: ObjectKeyVal): Promise<T>;
}

//This allows us to use generics and avoid typing using the "as" keyword to specify return types throughout the rest of the application
// TODO: Need to better handle non-200 responses.
// e.g. a 202 or 204 would result in an error.
// We are also swallowing any meaningful error responses.
export function useGenericApi(): GenericApiClient {
  return {
    async get<T>(path: string, options?: ObjectKeyVal): Promise<T> {
      const response = await useApi().get(path, options);
      if (response.body) return response.body as T;
      throw new Error(`Data not returned from GET '${path}'.`);
    },
    async post<T>(path: string, body: object, options?: ObjectKeyVal): Promise<T> {
      const response = await useApi().post(path, body, options);
      if (response.body) return response.body as T;
      throw new Error(`Data not returned from POST '${path}'.`);
    },
  };
}
