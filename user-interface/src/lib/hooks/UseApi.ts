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
