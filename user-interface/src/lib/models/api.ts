import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from '../utils/http.adapter';
import { ObjectKeyVal } from '../type-declarations/basic';
import { ResponseBody } from '@common/api/response';
import getApiConfiguration from '@/configuration/apiConfiguration';
import { sanitizeDeep } from '@common/cams/sanitization';
import { getAppInsights } from '../hooks/UseApplicationInsights';
import { SeverityLevel } from '@microsoft/applicationinsights-web';

const beforeHooks: (() => Promise<void>)[] = [];
const afterHooks: ((response: Response) => Promise<void>)[] = [];

const { baseUrl } = getApiConfiguration();

export function addApiBeforeHook(hook: () => Promise<void>) {
  const hookExists = beforeHooks.reduce((doesExist, registeredHook) => {
    return doesExist || registeredHook.toString() === hook.toString();
  }, false);
  if (!hookExists) {
    beforeHooks.push(hook);
  }
}

export function addApiAfterHook(hook: (response: Response) => Promise<void>) {
  const hookExists = afterHooks.reduce((doesExist, registeredHook) => {
    return doesExist || registeredHook.toString() === hook.toString();
  }, false);
  if (!hookExists) {
    afterHooks.push(hook);
  }
}

export default class Api {
  public static headers: Record<string, string> = {};

  public static host = baseUrl;

  public static createPath(path: string, params: ObjectKeyVal) {
    if (params && Object.keys(params).length > 0) {
      const paramArr: string[] = [];
      Object.entries(params).forEach(([key, value]) => {
        paramArr.push(`${key}=${value}`);
      });
      path += '?' + paramArr.join('&');
    }
    return path;
  }

  private static async executeBeforeHooks() {
    for (const hook of beforeHooks) {
      await hook();
    }
  }

  private static async executeAfterHooks(response: Response) {
    for (const hook of afterHooks) {
      await hook(response);
    }
  }

  private static sanitizeBodyWithLogging(body: object, path: string): object {
    const { appInsights } = getAppInsights();
    return sanitizeDeep(body, true, (invalidString) => {
      appInsights.trackTrace({
        message: 'Sanitization stripped potentially malicious content',
        severityLevel: SeverityLevel.Warning,
        properties: {
          endpoint: path,
          strippedContent: invalidString,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to POST requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @param {string} path The path after '/api'.
   * @param {object} body The payload for the request.
   * @param {ObjectKeyVal} [options] Query params in the form of key/value pairs.
   * @returns {Promise<ResponseBody | void>}
   */
  public static async post(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody | void> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassThrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);

      const sanitizedBody = this.sanitizeBodyWithLogging(body, path);

      const response = await httpPost({
        url: Api.host + pathStr,
        body: sanitizedBody,
        headers: this.headers,
      });
      await this.executeAfterHooks(response);

      if (response.ok) {
        const data = await response.text();
        return data.length > 1 ? JSON.parse(data) : undefined;
      } else {
        const error = await response.json();
        return Promise.reject(new Error(error.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async get(path: string, options?: ObjectKeyVal): Promise<ResponseBody> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassThrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpGet({ url: Api.host + pathStr, headers: this.headers });
      await this.executeAfterHooks(response);

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        if (response.status >= 500) {
          return Promise.reject(new Error(data.message));
        }
        return Promise.reject(new Error(`${response.status} Error - ${path} - ${data.message}`));
      }
    } catch (e) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async delete(path: string, options?: ObjectKeyVal): Promise<ResponseBody | void> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassThrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpDelete({ url: Api.host + pathStr, headers: this.headers });
      await this.executeAfterHooks(response);

      if (response.ok) {
        const data = await response.text();
        return data.length > 1 ? JSON.parse(data) : undefined;
      } else {
        const data = await response.json();
        return Promise.reject(new Error(data.message));
      }
    } catch (e) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  /**
   * ONLY USE WITH OUR OWN API!!!!
   * This function makes assumptions about the responses to PATCH requests that do not handle
   * all possibilities according to the HTTP specifications.
   *
   * @param {string} path The path after '/api'.
   * @param {object} body The payload for the request.
   * @param {ObjectKeyVal} [options] Query params in the form of key/value pairs.
   * @returns {Promise<ResponseBody | void>}
   */
  public static async patch(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody | void> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassThrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);

      const sanitizedBody = this.sanitizeBodyWithLogging(body, path);

      const response = await httpPatch({
        url: Api.host + pathStr,
        body: sanitizedBody,
        headers: this.headers,
      });
      await this.executeAfterHooks(response);

      if (response.ok) {
        const data = await response.text();
        return data.length > 1 ? JSON.parse(data) : undefined;
      } else {
        const error = await response.json();
        return Promise.reject(new Error(error.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async put(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseBody | void> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassThrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);

      const sanitizedBody = this.sanitizeBodyWithLogging(body, path);

      const response = await httpPut({
        url: Api.host + pathStr,
        body: sanitizedBody,
        headers: this.headers,
      });
      await this.executeAfterHooks(response);

      if (response.ok) {
        const data = await response.text();
        return data.length > 1 ? JSON.parse(data) : undefined;
      } else {
        const data = await response.json();
        return Promise.reject(new Error(data.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static getQueryStringsToPassThrough(
    search: string,
    options: ObjectKeyVal = {},
  ): ObjectKeyVal {
    const queryParams = new URLSearchParams(search);

    // Add to this list if there are query params that should be passed to backend api request
    const params = ['x-ms-routing-name'];

    params.forEach((key) => {
      const value = queryParams.get(key);
      if (value) {
        options[key] = value;
      }
    });
    return options;
  }
}
