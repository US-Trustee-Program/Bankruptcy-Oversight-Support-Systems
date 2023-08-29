import { httpGet, httpPost } from '../components/utils/http.adapter';
import config from '../configuration/apiConfiguration';
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

  public static async post(path: string, body: object): Promise<ResponseData> {
    try {
      const response = await httpPost({ url: Api._host + path, body });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`400 Error - Invalid Request ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async list(path: string, options?: ObjectKeyVal): Promise<ResponseData> {
    try {
      const apiOptions = options ? options : {};
      const pathStr = Api.createPath(path, apiOptions);
      const response = await httpGet({ url: Api._host + pathStr });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(
          new Error(`404 Error - Not Found ${data?.toString()} - Response was not OK`),
        );
      }
    } catch (e) {
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }
}
