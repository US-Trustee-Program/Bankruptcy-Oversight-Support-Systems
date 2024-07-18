import { httpGet, httpPatch, httpPost, httpPut } from '../utils/http.adapter';
import { ResponseData, SimpleResponseData } from '../type-declarations/api';
import { ObjectKeyVal } from '../type-declarations/basic';
import config from '../../configuration/apiConfiguration';
import {
  Chapter15CaseDetailsResponseData,
  Chapter15CaseSummaryResponseData,
} from '@/lib/type-declarations/chapter-15';
import { ResponseBody } from '@common/api/response';

const beforeHooks: (() => Promise<void>)[] = [];
const afterHooks: ((response: Response) => Promise<void>)[] = [];

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

  public static host = `${config.protocol || 'https'}://${config.server}:${config.port}${config.basePath ?? ''}`;

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

  public static async post(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseData> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassthrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);

      const response = await httpPost({ url: Api.host + pathStr, body, headers: this.headers });
      await this.executeAfterHooks(response);

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(data.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async list(path: string, options: ObjectKeyVal = {}): Promise<ResponseData> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassthrough(window.location.search, options);
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

  public static async get(
    path: string,
    options?: ObjectKeyVal,
  ): Promise<
    | Chapter15CaseSummaryResponseData
    | Chapter15CaseDetailsResponseData
    | SimpleResponseData
    | ResponseBody
  > {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassthrough(window.location.search, options);
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

  public static async patch(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseData> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassthrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpPatch({ url: Api.host + pathStr, body, headers: this.headers });
      await this.executeAfterHooks(response);

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(data.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async put(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseData> {
    try {
      await this.executeBeforeHooks();
      const apiOptions = this.getQueryStringsToPassthrough(window.location.search, options);
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpPut({ url: Api.host + pathStr, body, headers: this.headers });
      await this.executeAfterHooks(response);

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(data.message));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static getQueryStringsToPassthrough(
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
