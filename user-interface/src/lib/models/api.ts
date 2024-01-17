import { httpGet, httpPatch, httpPost } from '../utils/http.adapter';
import config from '../../configuration/apiConfiguration';
import { ResponseData } from '../type-declarations/api';
import { ObjectKeyVal } from '../type-declarations/basic';

export default class Api {
  private static _host = `${config.protocol || 'https'}://${config.server}:${config.port}${
    config.basePath ?? ''
  }`;

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

  public static async post(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseData> {
    try {
      const apiOptions = this.getQueryStringsToPassthrough(options ?? {});
      const pathStr = Api.createPath(path, apiOptions);

      const response = await httpPost({ url: Api._host + pathStr, body });

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
      const apiOptions = this.getQueryStringsToPassthrough(options ?? {});
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpGet({ url: Api._host + pathStr });

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

  public static async get(path: string, options?: ObjectKeyVal): Promise<ResponseData> {
    try {
      const apiOptions = this.getQueryStringsToPassthrough(options ?? {});
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpGet({ url: Api._host + pathStr });

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

  public static getQueryStringsToPassthrough(options: ObjectKeyVal): ObjectKeyVal {
    const queryParams = new URLSearchParams(window.location.search);

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

  public static async patch(
    path: string,
    body: object,
    options?: ObjectKeyVal,
  ): Promise<ResponseData> {
    try {
      const apiOptions = this.getQueryStringsToPassthrough(options ?? {});
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpPatch({ url: Api._host + pathStr, body });

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
}
