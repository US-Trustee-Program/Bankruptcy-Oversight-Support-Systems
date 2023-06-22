import { httpGet, httpPost } from '../components/utils/http.adapter';
import config from '../configuration/apiConfiguration';

export type CaseListResponseData = {
  message: string;
  count: number;
  body: {
    staff1Label: string;
    staff2Label: string;
    caseList: Array<object>;
  };
};

export type Chapter15CaseListResponseData = {
  message: string;
  count: number;
  body: {
    caseList: Array<object>;
  };
};

export type ResponseData = {
  message: string;
  count: number;
  body: object | Array<object>;
};

export type ResponseError = {
  message: string;
  error: object;
};

export type ObjectKeyVal = {
  [key: string]: string | number;
};

export default class Api {
  private static _host = `${config.protocol}://${config.server}:${config.port}${
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
      console.log('about to call http post');
      const response = await httpPost({ url: Api._host + path, body });
      console.log('response from post: ', response);

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`400 Error - Invalid Request ${data?.toString()}`));
      }
    } catch (e: unknown) {
      console.log('ERROR THROWN SUCCESSFULLY', e);
      return Promise.reject(new Error(`500 Error - Server Error ${(e as Error).message}`));
    }
  }

  public static async list(path: string, options: ObjectKeyVal): Promise<ResponseData> {
    try {
      const pathStr = Api.createPath(path, options);
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
